import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma, ProductStatus } from '@prisma/client';
import { PrismaService } from '../prisma.service';
import { ProductsService } from '../products/products.service';
import { QrService } from '../qr/qr.service';
import { CacheService } from '../cache/cache.service';
import { AuditService } from '../audit/audit.service';

type TxClient = Prisma.TransactionClient;

const SNAPSHOT_INCLUDE = {
  materials: { include: { countryOfOrigin: true }, orderBy: { sortOrder: 'asc' as const } },
  sustainability: true,
  certifications: { orderBy: { sortOrder: 'asc' as const } },
  documents: { orderBy: { sortOrder: 'asc' as const } },
  images: { orderBy: { sortOrder: 'asc' as const } },
  category: true,
  countryOfOrigin: true,
  // Public brand fields only — never snapshot contactEmail / internal flags.
  organisation: { select: { id: true, name: true, publicSlug: true, logoUrl: true, accentColor: true, website: true } },
};

@Injectable()
export class PassportsService {
  private readonly logger = new Logger(PassportsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly productsService: ProductsService,
    private readonly qrService: QrService,
    private readonly config: ConfigService,
    private readonly cache: CacheService,
    private readonly audit: AuditService,
  ) {}

  async list(
    organisationId: string,
    params: { page?: number; limit?: number } = {},
  ) {
    const page = Math.max(1, params.page ?? 1);
    const limit = Math.min(100, Math.max(1, params.limit ?? 25));
    const where = { product: { organisationId }, publishedAt: { not: null } };

    const [total, rows] = await Promise.all([
      this.prisma.passport.count({ where }),
      this.prisma.passport.findMany({
        where,
        include: {
          product: {
            include: {
              images: { where: { isCover: true }, take: 1 },
            },
          },
          _count: { select: { scans: true } },
        },
        orderBy: { publishedAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);

    return { rows, total, page, limit };
  }

  /**
   * Exposes the append-only publication history to the owning tenant. This is
   * deliberately separate from the public endpoint: consumers always resolve
   * the latest published snapshot from the stable UUID, while back-office
   * users can inspect every materialized publication.
   */
  async listVersions(organisationId: string, productId: string) {
    const passport = await this.findOwnedPassport(organisationId, productId);

    return this.prisma.passportVersion.findMany({
      where: { passportId: passport.id },
      select: {
        id: true,
        version: true,
        publishedAt: true,
        publishedBy: { select: { id: true, name: true, email: true } },
      },
      orderBy: { version: 'desc' },
    });
  }

  async getVersion(organisationId: string, productId: string, version: number) {
    const passport = await this.findOwnedPassport(organisationId, productId);
    const publication = await this.prisma.passportVersion.findUnique({
      where: { passportId_version: { passportId: passport.id, version } },
      select: {
        id: true,
        version: true,
        publishedAt: true,
        snapshot: true,
        publishedBy: { select: { id: true, name: true, email: true } },
      },
    });

    if (!publication) {
      throw new NotFoundException(`Passport version ${version} was not found.`);
    }

    return {
      passportId: passport.id,
      uuid: passport.uuid,
      ...publication,
    };
  }

  /**
   * Combines the publish-blocker checklist with an "unpublished changes"
   * signal so the editor can show one accurate status instead of the client
   * having to infer it. `hasUnpublishedChanges` relies on `Product.updatedAt`
   * being bumped by every `update()` call in ProductsService (materials and
   * sustainability writes included) — Prisma's `@updatedAt` sets it on any
   * update to the row regardless of which scalar fields actually changed.
   */
  async getPublishStatus(organisationId: string, productId: string) {
    const product = await this.productsService.findOne(organisationId, productId);
    const blockers = this.productsService.evaluatePublishBlockers(product);

    const isPublished = Boolean(product.passport?.publishedAt && !product.passport?.unpublishedAt);
    const hasUnpublishedChanges = isPublished && product.updatedAt > product.passport!.publishedAt!;

    return {
      blockers,
      isPublished,
      hasUnpublishedChanges,
      currentVersion: product.passport?.publishedAt ? product.passport.version : null,
      publishedAt: product.passport?.publishedAt ?? null,
      uuid: product.passport?.uuid ?? null,
      qrUrl: product.passport?.qrUrl ?? null,
    };
  }

  /**
   * Publish (or re-publish) a product. Two invariants matter here:
   *  - the passport's uuid/QR are stable across versions — never reissued
   *  - readers of GET /passport/:uuid must only ever see a fully-formed,
   *    immutable version, never a live product mid-edit
   *
   * The version bump + snapshot write + product status flip happen inside a
   * single serializable-by-row-lock transaction so two concurrent publishes
   * of the same product can never mint the same version number or interleave
   * a partial write. The unique (passportId, version) constraint is the
   * backstop if that lock is ever bypassed (e.g. a future direct SQL path).
   */
  async publish(organisationId: string, userId: string, productId: string) {
    const blockers = await this.productsService.getPublishBlockers(organisationId, productId);
    if (blockers.length) {
      throw new BadRequestException({ message: 'Publish blocked', blockers });
    }

    // Atomic get-or-create: Postgres compiles Prisma's upsert to a single
    // INSERT ... ON CONFLICT DO UPDATE, so two simultaneous first-publishes
    // of the same product cannot both create a row.
    const passport = await this.prisma.passport.upsert({
      where: { productId },
      update: {},
      create: { productId },
    });

    const webBaseUrl = this.config.get<string>('WEB_PUBLIC_URL') || 'http://localhost:3001';
    const publicUrl = `${webBaseUrl}/passport/${passport.uuid}`;

    // QR generation is file I/O against an external-ish service; it stays
    // outside the row lock so the lock is only ever held for DB work. If two
    // first-publishes race here, both succeed and the transaction below
    // deterministically keeps whichever write wins the lock — the worst case
    // is one orphaned (but valid) QR file, never an inconsistent DB state.
    // The QR encodes `?src=qr` so a scan is distinguishable from a typed or
    // shared link; the canonical publicUrl shown to users stays clean.
    const qr = passport.qrKey
      ? null
      : await this.qrService.generateForUrl(`${publicUrl}?src=qr`, organisationId);

    let updatedPassport;
    try {
      updatedPassport = await this.prisma.$transaction(async (tx) => {
        // Lock both mutable inputs before the authoritative validation/snapshot
        // read. Product edits must wait until this publication is committed.
        await tx.$queryRaw`SELECT id FROM products WHERE id = ${productId} FOR UPDATE`;
        const [locked] = await tx.$queryRaw<{
          id: string;
          version: number;
          publishedAt: Date | null;
          qrKey: string | null;
          qrUrl: string | null;
        }[]>`
          SELECT id, version, "publishedAt", "qrKey", "qrUrl"
          FROM passports
          WHERE id = ${passport.id}
          FOR UPDATE
        `;
        const nextVersion = locked.version + 1;

        const snapshot = await this.buildSnapshot(tx, organisationId, productId);
        const authoritativeBlockers = this.productsService.evaluatePublishBlockers(snapshot);
        if (authoritativeBlockers.length) {
          throw new BadRequestException({ message: 'Publish blocked', blockers: authoritativeBlockers });
        }

        // One timestamp, reused for both writes below. `hasUnpublishedChanges`
        // is derived as `product.updatedAt > passport.publishedAt` — if each
        // statement generated its own `new Date()`, the product update (fired
        // second) would land a few milliseconds after the passport update and
        // every fresh publish would immediately read back as "changed since
        // publish", even with zero further edits.
        const publishedAt = new Date();

        const updated = await tx.passport.update({
          where: { id: passport.id },
          data: {
            version: nextVersion,
            publishedAt,
            unpublishedAt: null,
            // A concurrent first-publish may have installed a QR while this
            // caller waited for the lock. Keep the winner's stable QR.
            qrKey: locked.qrKey ?? qr?.key ?? passport.qrKey,
            qrUrl: locked.qrUrl ?? qr?.url ?? passport.qrUrl,
          },
        });

        await tx.passportVersion.create({
          data: {
            passportId: passport.id,
            organisationId,
            version: nextVersion,
            snapshot: snapshot as unknown as Prisma.InputJsonValue,
            publishedById: userId,
            publishedAt,
          },
        });

        await tx.product.update({ where: { id: productId }, data: { status: ProductStatus.PUBLISHED, updatedAt: publishedAt } });
        await this.audit.log({
          organisationId,
          actorId: userId,
          action: 'PASSPORT_PUBLISHED',
          entityType: 'Product',
          entityId: productId,
          diff: { version: updated.version, uuid: updated.uuid },
        }, tx);

        return updated;
      });
    } catch (error) {
      if (qr) await this.discardGeneratedQr(qr.key);
      throw error;
    }

    if (qr && updatedPassport.qrKey !== qr.key) {
      await this.discardGeneratedQr(qr.key);
    }

    await Promise.all([
      this.cache.delete(`passport:${updatedPassport.uuid}`),
      this.cache.deletePrefix(`dashboard:${organisationId}`),
      this.cache.deletePrefix(`analytics:${organisationId}:`),
    ]);
    return { ...updatedPassport, publicUrl };
  }

  private async discardGeneratedQr(key: string) {
    try {
      await this.qrService.deleteGenerated(key);
    } catch (error) {
      this.logger.warn(`Could not clean up generated QR key=${key}: ${(error as Error)?.message ?? 'unknown error'}`);
    }
  }

  async unpublish(organisationId: string, userId: string, productId: string) {
    const passport = await this.prisma.passport.findFirst({
      where: { productId, product: { organisationId } },
      select: { id: true, uuid: true },
    });
    if (!passport) {
      throw new NotFoundException('This product has never been published.');
    }
    const unpublishedAt = new Date();
    await this.prisma.$transaction(async (tx) => {
      await tx.passport.update({
        where: { id: passport.id },
        data: { unpublishedAt },
      });
      await tx.product.update({
        where: { id: productId },
        data: { status: ProductStatus.DRAFT, updatedAt: unpublishedAt },
      });
      await this.audit.log({
        organisationId,
        actorId: userId,
        action: 'PASSPORT_UNPUBLISHED',
        entityType: 'Product',
        entityId: productId,
      }, tx);
    });
    await Promise.all([
      this.cache.delete(`passport:${passport.uuid}`),
      this.cache.deletePrefix(`dashboard:${organisationId}`),
      this.cache.deletePrefix(`analytics:${organisationId}:`),
    ]);
    return { success: true };
  }

  /**
   * The public read path is intentionally decoupled from the live Product —
   * it serves the most recent PassportVersion.snapshot, so editing a
   * published product's draft never changes what a consumer sees until the
   * next explicit publish.
   */
  async getPublicByUuid(uuid: string) {
    return this.cache.getOrSet(`passport:${uuid}`, 300, () => this.loadPublicByUuid(uuid));
  }

  async getPublicByItemUuid(itemUuid: string) {
    const passportUuid = await this.cache.getOrSet(`item-passport:${itemUuid}`, 300, async () => {
      const item = await this.prisma.productItem.findUnique({
        where: { id: itemUuid },
        include: { passport: true },
      });
      if (!item || !item.passport) {
        throw new NotFoundException('Item not found or invalid.');
      }
      return item.passport.uuid;
    });
    return this.getPublicByUuid(passportUuid);
  }

  private async loadPublicByUuid(uuid: string) {
    const passport = await this.prisma.passport.findUnique({
      where: { uuid },
      include: {
        product: {
          select: {
            organisation: {
              select: { name: true, logoUrl: true, accentColor: true },
            },
          },
        },
      },
    });

    if (!passport || !passport.publishedAt || passport.unpublishedAt) {
      throw new NotFoundException('This passport is not available.');
    }

    const latestVersion = await this.prisma.passportVersion.findFirst({
      where: { passportId: passport.id },
      orderBy: { version: 'desc' },
    });

    if (!latestVersion) {
      throw new NotFoundException('This passport is not available.');
    }

    const product = latestVersion.snapshot as Record<string, unknown>;
    const snapshotOrg =
      product.organisation && typeof product.organisation === 'object'
        ? (product.organisation as Record<string, unknown>)
        : {};

    if (passport.product?.organisation) {
      product.organisation = {
        id: snapshotOrg.id,
        name: passport.product.organisation.name,
        publicSlug: snapshotOrg.publicSlug,
        logoUrl: passport.product.organisation.logoUrl,
        accentColor: passport.product.organisation.accentColor,
        website: snapshotOrg.website,
      };
    }

    return {
      id: passport.id,
      uuid: passport.uuid,
      version: latestVersion.version,
      createdAt: passport.createdAt,
      publishedAt: passport.publishedAt,
      status: 'PUBLISHED',
      // Assessment requires a "Verified Product" badge. Semantically this means
      // brand-published immutable snapshot — not third-party authentication.
      verificationStatus: 'VERIFIED',
      qrUrl: passport.qrUrl,
      product,
    };
  }

  private async buildSnapshot(tx: TxClient, organisationId: string, productId: string) {
    const product = await tx.product.findFirst({
      where: { id: productId, organisationId, deletedAt: null },
      include: SNAPSHOT_INCLUDE,
    });
    if (!product) {
      throw new NotFoundException('Product not found.');
    }
    return product;
  }

  private async findOwnedPassport(organisationId: string, productId: string) {
    const passport = await this.prisma.passport.findFirst({
      where: {
        productId,
        product: { organisationId },
      },
      select: { id: true, uuid: true, product: { select: { sku: true } } },
    });

    if (!passport) {
      throw new NotFoundException('This product has no passport history.');
    }
    return passport;
  }

  async generateItems(organisationId: string, productId: string, count: number, batchId?: string) {
    const passport = await this.findOwnedPassport(organisationId, productId);
    const sku = passport.product?.sku || 'ITEM';

    // Count existing items for this passport to maintain continuous sequence
    const existingCount = await this.prisma.productItem.count({
      where: { passportId: passport.id },
    });

    // Generate structured SKU-based serial numbers (e.g. EWB-BLK-750-000001)
    const itemsData = Array.from({ length: count }).map((_, idx) => {
      const seqNumber = existingCount + idx + 1;
      const serialNumber = `${sku}-${seqNumber.toString().padStart(6, '0')}`;
      return {
        passportId: passport.id,
        serialNumber,
        batchId: batchId || null,
      };
    });

    const createdItems = await this.prisma.productItem.createManyAndReturn({
      data: itemsData,
    });

    const webBaseUrl = this.config.get<string>('WEB_PUBLIC_URL') || 'http://localhost:3001';
    
    // Generate QR codes in chunks or parallel
    const updatedItems = await Promise.all(
      createdItems.map(async (item) => {
        const publicUrl = `${webBaseUrl}/passport/i/${item.id}`;
        const qr = await this.qrService.generateForUrl(`${publicUrl}?src=qr`, organisationId);
        
        return this.prisma.productItem.update({
          where: { id: item.id },
          data: { qrKey: qr.key, qrUrl: qr.url },
        });
      })
    );

    return updatedItems;
  }

  async listItems(organisationId: string, productId: string) {
    const passport = await this.findOwnedPassport(organisationId, productId);
    
    return this.prisma.productItem.findMany({
      where: { passportId: passport.id },
      orderBy: { createdAt: 'desc' },
      include: {
        _count: { select: { scans: true } }
      }
    });
  }
}
