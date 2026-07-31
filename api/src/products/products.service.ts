import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, ProductStatus } from '@prisma/client';
import { PrismaService } from '../prisma.service';
import { CreateProductDto, UpdateProductDto } from './dto/product.dto';
import { CacheService } from '../cache/cache.service';
import { AuditService } from '../audit/audit.service';
import { CacheKeys } from '../cache/cache.keys';

export interface PublishBlocker {
  code: string;
  path: string;
  message: string;
}

const PRODUCT_INCLUDE = {
  materials: { include: { countryOfOrigin: true }, orderBy: { sortOrder: 'asc' as const } },
  sustainability: true,
  certifications: { orderBy: { sortOrder: 'asc' as const } },
  documents: { orderBy: { sortOrder: 'asc' as const } },
  images: { orderBy: { sortOrder: 'asc' as const } },
  passport: true,
  category: true,
  countryOfOrigin: true,
  organisation: true,
};

interface PublishableProduct {
  name: string;
  sku: string;
  categoryId: string | null;
  serialNumber: string | null;
  productionDate: Date | null;
  countryOfOriginId: string | null;
  materials: Array<{ percentage: number }>;
  sustainability: {
    carbonFootprintKg: number | null;
    waterConsumptionL: number | null;
    recycledPercent: number | null;
    repairabilityScore: number | null;
    recyclable: boolean | null;
  } | null;
  images: Array<{ isCover: boolean }>;
}

@Injectable()
export class ProductsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly cache: CacheService,
  ) {}

  async list(
    organisationId: string,
    params: { search?: string; status?: ProductStatus; categoryId?: string; page?: number; limit?: number },
  ) {
    const page = params.page ?? 1;
    const limit = params.limit ?? 25;
    const search = params.search?.trim();

    const where = {
      organisationId,
      deletedAt: null,
      ...(params.status ? { status: params.status } : {}),
      ...(params.categoryId ? { categoryId: params.categoryId } : {}),
    };

    if (search) {
      const statusClause = params.status ? Prisma.sql`AND p.status = ${params.status}::"ProductStatus"` : Prisma.empty;
      const categoryClause = params.categoryId ? Prisma.sql`AND p."categoryId" = ${params.categoryId}` : Prisma.empty;
      const contains = `%${search}%`;
      const offset = (page - 1) * limit;
      const [rankedIds, countRows] = await Promise.all([
        this.prisma.$queryRaw<Array<{ id: string }>>(Prisma.sql`
          SELECT p.id
          FROM products p
          WHERE p."organisationId" = ${organisationId}
            AND p."deletedAt" IS NULL
            ${statusClause}
            ${categoryClause}
            AND (
              p."searchVector" @@ plainto_tsquery('simple', ${search})
              OR p.name ILIKE ${contains}
              OR p.sku ILIKE ${contains}
            )
          ORDER BY
            ts_rank(p."searchVector", plainto_tsquery('simple', ${search})) DESC,
            p."createdAt" DESC
          LIMIT ${limit} OFFSET ${offset}
        `),
        this.prisma.$queryRaw<Array<{ count: bigint }>>(Prisma.sql`
          SELECT COUNT(*)::bigint AS count
          FROM products p
          WHERE p."organisationId" = ${organisationId}
            AND p."deletedAt" IS NULL
            ${statusClause}
            ${categoryClause}
            AND (
              p."searchVector" @@ plainto_tsquery('simple', ${search})
              OR p.name ILIKE ${contains}
              OR p.sku ILIKE ${contains}
            )
        `),
      ]);
      const ids = rankedIds.map((row) => row.id);
      const found = ids.length
        ? await this.prisma.product.findMany({
            where: { id: { in: ids } },
            include: {
              passport: { include: { _count: { select: { scans: true } } } },
              images: { where: { isCover: true }, take: 1 },
            },
          })
        : [];
      const byId = new Map(found.map((row) => [row.id, row]));
      const rows = ids.map((id) => byId.get(id)).filter((row): row is NonNullable<typeof row> => Boolean(row));
      return this.formatList(rows, Number(countRows[0]?.count ?? 0), page, limit);
    }

    const [total, rows] = await Promise.all([
      this.prisma.product.count({ where }),
      this.prisma.product.findMany({
        where,
        include: {
          passport: { include: { _count: { select: { scans: true } } } },
          images: { where: { isCover: true }, take: 1 },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);

    return this.formatList(rows, total, page, limit);
  }

  private formatList<
    T extends {
      updatedAt: Date;
      passport: { publishedAt: Date | null; unpublishedAt: Date | null; _count: { scans: number } } | null;
    },
  >(rows: T[], total: number, page: number, limit: number) {
    return {
      rows: rows.map((row) => ({
        ...row,
        views: row.passport?._count.scans ?? 0,
        hasUnpublishedChanges: Boolean(
          row.passport?.publishedAt && !row.passport.unpublishedAt && row.updatedAt > row.passport.publishedAt,
        ),
      })),
      total,
      page,
      limit,
    };
  }

  async findOne(organisationId: string, id: string) {
    const product = await this.prisma.product.findFirst({
      where: { id, organisationId, deletedAt: null },
      include: PRODUCT_INCLUDE,
    });
    if (!product) {
      throw new NotFoundException('Product not found.');
    }
    return product;
  }

  async create(organisationId: string, dto: CreateProductDto, actorId: string) {
    const existing = await this.prisma.product.findFirst({
      where: { organisationId, sku: dto.sku, deletedAt: null },
      select: { id: true },
    });
    if (existing) {
      throw new ConflictException(`SKU "${dto.sku}" is already used by another product.`);
    }

    const product = await this.prisma.$transaction(async (tx) => {
      const created = await tx.product.create({
        data: { organisationId, name: dto.name, sku: dto.sku, status: ProductStatus.DRAFT },
        include: PRODUCT_INCLUDE,
      });
      await this.audit.log({
        organisationId,
        actorId,
        action: 'PRODUCT_CREATED',
        entityType: 'Product',
        entityId: created.id,
        diff: { name: created.name, sku: created.sku },
      }, tx);
      return created;
    });
    await this.invalidateOrganisationStats(organisationId);
    return product;
  }

  async update(organisationId: string, id: string, dto: UpdateProductDto, actorId: string) {
    const before = await this.findOne(organisationId, id);

    if (dto.sku) {
      const existing = await this.prisma.product.findFirst({
        where: { organisationId, sku: dto.sku, deletedAt: null, NOT: { id } },
        select: { id: true },
      });
      if (existing) {
        throw new ConflictException(`SKU "${dto.sku}" is already used by another product.`);
      }
    }

    const { materials, sustainability, ...fields } = dto;

    await this.assertTaxonomyOwnership(organisationId, {
      categoryId: dto.categoryId,
      countryIds: [dto.countryOfOriginId, ...(materials ?? []).map((m) => m.countryOfOriginId)].filter(
        (v): v is string => Boolean(v),
      ),
    });

    await this.prisma.$transaction(async (tx) => {
      await tx.product.update({
        where: { id },
        data: {
          ...fields,
          // Distinguish "not supplied" (omit) from "explicitly cleared" (null).
          // Collapsing both to undefined made clearing a production date a no-op.
          productionDate:
            dto.productionDate === undefined
              ? undefined
              : dto.productionDate === null
                ? null
                : new Date(dto.productionDate),
        },
      });

      if (materials) {
        await tx.material.deleteMany({ where: { productId: id } });
        if (materials.length) {
          await tx.material.createMany({
            data: materials.map((m, index) => ({
              productId: id,
              organisationId,
              name: m.name,
              percentage: m.percentage,
              countryOfOriginId: m.countryOfOriginId,
              recyclable: m.recyclable ?? false,
              sortOrder: index,
            })),
          });
        }
      }

      if (sustainability) {
        await tx.sustainability.upsert({
          where: { productId: id },
          create: { productId: id, ...sustainability },
          update: sustainability,
        });
      }

      const changed = Object.fromEntries(
        Object.keys(dto).map((field) => [
          field,
          {
            from: JSON.parse(JSON.stringify(before[field as keyof typeof before] ?? null)) as unknown,
            to: JSON.parse(JSON.stringify(dto[field as keyof UpdateProductDto] ?? null)) as unknown,
          },
        ]),
      );
      await this.audit.log({
        organisationId,
        actorId,
        action: 'PRODUCT_UPDATED',
        entityType: 'Product',
        entityId: id,
        diff: {
          productName: dto.name ?? before.name,
          changed,
        } as Prisma.InputJsonValue,
      }, tx);
    });

    await this.invalidateOrganisationStats(organisationId);
    return this.findOne(organisationId, id);
  }

  /**
   * Prevents a caller from linking a product to another organisation's
   * category/country by simply guessing its id — foreign-key validity alone
   * doesn't imply tenant ownership.
   */
  private async assertTaxonomyOwnership(
    organisationId: string,
    refs: { categoryId?: string | null; countryIds: string[] },
  ) {
    if (refs.categoryId) {
      const category = await this.prisma.category.findFirst({ where: { id: refs.categoryId, organisationId } });
      if (!category) {
        throw new BadRequestException('Category does not belong to this organisation.');
      }
    }

    const uniqueCountryIds = [...new Set(refs.countryIds)];
    if (uniqueCountryIds.length) {
      const found = await this.prisma.country.count({ where: { id: { in: uniqueCountryIds }, organisationId } });
      if (found !== uniqueCountryIds.length) {
        throw new BadRequestException('One or more countries do not belong to this organisation.');
      }
    }
  }

  async softDelete(organisationId: string, id: string, actorId: string) {
    const product = await this.findOne(organisationId, id);
    const deletedAt = new Date();
    await this.prisma.$transaction(async (tx) => {
      // Archiving the mutable authoring record must not revoke an already
      // issued passport. This mirrors the NFC template/token lifecycle:
      // deleting the template leaves the materialized tokenUri metadata
      // available. Public withdrawal remains an explicit `unpublish` action.
      await tx.product.update({
        where: { id },
        data: { deletedAt, updatedAt: deletedAt },
      });
      await this.audit.log({
        organisationId,
        actorId,
        action: 'PRODUCT_ARCHIVED',
        entityType: 'Product',
        entityId: id,
        diff: {
          productName: product.name,
          passportPreserved: Boolean(product.passport?.publishedAt && !product.passport.unpublishedAt),
        },
      }, tx);
    });
    await Promise.all([
      this.cache.deletePrefix(CacheKeys.dashboard(organisationId)),
      this.cache.deletePrefix(CacheKeys.analyticsPrefix(organisationId)),
    ]);
    return {
      success: true,
      passportPreserved: Boolean(
        product.passport?.publishedAt && !product.passport.unpublishedAt,
      ),
    };
  }

  /**
   * Server-side publish validation — the single source of truth a client
   * checklist mirrors. Each blocker carries a `code` and `path` (the field
   * it maps to) rather than only a display string, so a UI can link a
   * blocker straight to the offending field instead of just showing text.
   */
  async getPublishBlockers(organisationId: string, id: string): Promise<PublishBlocker[]> {
    const product = await this.findOne(organisationId, id);
    return this.evaluatePublishBlockers(product);
  }

  evaluatePublishBlockers(product: PublishableProduct): PublishBlocker[] {
    const blockers: PublishBlocker[] = [];

    if (!product.name || !product.sku || !product.categoryId) {
      blockers.push({ code: 'IDENTITY_INCOMPLETE', path: 'general', message: 'Product name, SKU and category are required.' });
    }
    if (!product.images.some((i) => i.isCover)) {
      blockers.push({ code: 'COVER_IMAGE_MISSING', path: 'images', message: 'A cover image is required.' });
    }
    if (!product.serialNumber) {
      blockers.push({ code: 'SERIAL_NUMBER_MISSING', path: 'general', message: 'Serial number is required.' });
    }
    if (!product.productionDate) {
      blockers.push({ code: 'PRODUCTION_DATE_MISSING', path: 'general', message: 'Production date is required.' });
    }
    if (!product.countryOfOriginId) {
      blockers.push({
        code: 'COUNTRY_OF_ORIGIN_MISSING',
        path: 'general',
        message: 'Country of origin is required.',
      });
    }
    const materialTotal = product.materials.reduce((sum, m) => sum + m.percentage, 0);
    if (!product.materials.length || Math.abs(materialTotal - 100) > 0.01) {
      blockers.push({
        code: 'MATERIAL_TOTAL',
        path: 'materials',
        message: `Material percentages must total 100%. Currently ${materialTotal.toFixed(0)}%.`,
      });
    }
    if (!product.sustainability) {
      blockers.push({
        code: 'SUSTAINABILITY_MISSING',
        path: 'sustainability',
        message: 'Sustainability information is required.',
      });
    } else {
      if (product.sustainability.carbonFootprintKg == null) {
        blockers.push({
          code: 'CARBON_FOOTPRINT_MISSING',
          path: 'sustainability',
          message: 'Carbon footprint is required.',
        });
      }
      if (product.sustainability.waterConsumptionL == null) {
        blockers.push({
          code: 'WATER_CONSUMPTION_MISSING',
          path: 'sustainability',
          message: 'Water consumption is required.',
        });
      }
      if (product.sustainability.recycledPercent == null) {
        blockers.push({
          code: 'RECYCLED_PERCENT_MISSING',
          path: 'sustainability',
          message: 'Recycled material percentage is required.',
        });
      }
      if (product.sustainability.repairabilityScore == null) {
        blockers.push({
          code: 'REPAIRABILITY_SCORE_MISSING',
          path: 'sustainability',
          message: 'Repairability score is required.',
        });
      }
    }

    return blockers;
  }

  private touchProduct(tx: Prisma.TransactionClient, productId: string) {
    return tx.product.update({ where: { id: productId }, data: { updatedAt: new Date() } });
  }

  private invalidateOrganisationStats(organisationId: string) {
    return Promise.all([
      this.cache.deletePrefix(CacheKeys.dashboard(organisationId)),
      this.cache.deletePrefix(CacheKeys.analyticsPrefix(organisationId)),
    ]);
  }

  async assertOwnership(organisationId: string, id: string) {
    return this.findOne(organisationId, id);
  }
}
