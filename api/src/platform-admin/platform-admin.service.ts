import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, Role } from '@prisma/client';
import { PrismaService } from '../prisma.service';
import { AuditLogQueryDto, ListBrandsQueryDto } from './dto/platform-admin.dto';
import { AuditService } from '../audit/audit.service';

/** Sentinel used by the console to ask for entries with no organisation. */
export const PLATFORM_SCOPE = 'platform';

@Injectable()
export class PlatformAdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async overview() {
    const [brands, activeBrands, brandUsers, products, publishedPassports, scans] = await Promise.all([
      this.prisma.organisation.count(),
      this.prisma.organisation.count({ where: { disabledAt: null } }),
      this.prisma.user.count({
        where: { role: { in: [Role.OWNER, Role.MANAGER, Role.EDITOR] }, disabledAt: null },
      }),
      this.prisma.product.count({ where: { deletedAt: null } }),
      this.prisma.passport.count({ where: { publishedAt: { not: null }, unpublishedAt: null } }),
      this.prisma.scan.count(),
    ]);
    return { brands, activeBrands, suspendedBrands: brands - activeBrands, brandUsers, products, publishedPassports, scans };
  }

  async getAnalytics() {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const [
      dailyScansRaw,
      topBrandsRaw,
      countryScansRaw,
      browserScansRaw,
      topBrandAllTimeRaw,
      topBrandThisMonthRaw,
      mostScannedBrandRaw,
      topTrendingProductRaw,
    ] = await Promise.all([
      this.prisma.$queryRaw<Array<{ date: string; count: number }>>(Prisma.sql`
        SELECT DATE_TRUNC('day', "timestamp")::date::text AS date, COUNT(id)::int AS count
        FROM scans
        WHERE "timestamp" >= ${thirtyDaysAgo}
        GROUP BY DATE_TRUNC('day', "timestamp")
        ORDER BY date ASC
      `),
      this.prisma.$queryRaw<Array<{ name: string; passports: number; scans: number }>>(Prisma.sql`
        SELECT
          o.name,
          COUNT(DISTINCT pa.id)::int AS passports,
          COUNT(s.id)::int AS scans
        FROM organisations o
        LEFT JOIN products p ON p."organisationId" = o.id AND p."deletedAt" IS NULL
        LEFT JOIN passports pa ON pa."productId" = p.id AND pa."publishedAt" IS NOT NULL AND pa."unpublishedAt" IS NULL
        LEFT JOIN scans s ON s."passportId" = pa.id
        GROUP BY o.id, o.name
        ORDER BY scans DESC, passports DESC
        LIMIT 5
      `),
      this.prisma.$queryRaw<Array<{ country: string; count: number }>>(Prisma.sql`
        SELECT COALESCE(country, 'XX') AS country, COUNT(id)::int AS count
        FROM scans
        GROUP BY country
        ORDER BY count DESC
        LIMIT 6
      `),
      this.prisma.$queryRaw<Array<{ browser: string; count: number }>>(Prisma.sql`
        SELECT COALESCE(browser, 'Other') AS browser, COUNT(id)::int AS count
        FROM scans
        GROUP BY browser
        ORDER BY count DESC
        LIMIT 6
      `),
      this.prisma.$queryRaw<Array<{ id: string; name: string; publicSlug: string; passports: number }>>(Prisma.sql`
        SELECT o.id, o.name, o."publicSlug", COUNT(pa.id)::int AS passports
        FROM organisations o
        JOIN products p ON p."organisationId" = o.id AND p."deletedAt" IS NULL
        JOIN passports pa ON pa."productId" = p.id AND pa."publishedAt" IS NOT NULL AND pa."unpublishedAt" IS NULL
        GROUP BY o.id, o.name, o."publicSlug"
        ORDER BY passports DESC
        LIMIT 1
      `),
      this.prisma.$queryRaw<Array<{ id: string; name: string; publicSlug: string; passportsThisMonth: number }>>(Prisma.sql`
        SELECT o.id, o.name, o."publicSlug", COUNT(pa.id)::int AS "passportsThisMonth"
        FROM organisations o
        JOIN products p ON p."organisationId" = o.id AND p."deletedAt" IS NULL
        JOIN passports pa ON pa."productId" = p.id AND pa."publishedAt" >= ${startOfMonth} AND pa."unpublishedAt" IS NULL
        GROUP BY o.id, o.name, o."publicSlug"
        ORDER BY "passportsThisMonth" DESC
        LIMIT 1
      `),
      this.prisma.$queryRaw<Array<{ id: string; name: string; publicSlug: string; totalScans: number }>>(Prisma.sql`
        SELECT o.id, o.name, o."publicSlug", COUNT(s.id)::int AS "totalScans"
        FROM organisations o
        JOIN products p ON p."organisationId" = o.id AND p."deletedAt" IS NULL
        JOIN passports pa ON pa."productId" = p.id
        JOIN scans s ON s."passportId" = pa.id
        GROUP BY o.id, o.name, o."publicSlug"
        ORDER BY "totalScans" DESC
        LIMIT 1
      `),
      this.prisma.$queryRaw<Array<{ productName: string; sku: string; brandName: string; scanCount: number }>>(Prisma.sql`
        SELECT p.name AS "productName", p.sku, o.name AS "brandName", COUNT(s.id)::int AS "scanCount"
        FROM products p
        JOIN organisations o ON o.id = p."organisationId"
        JOIN passports pa ON pa."productId" = p.id
        JOIN scans s ON s."passportId" = pa.id
        GROUP BY p.id, p.name, p.sku, o.name
        ORDER BY "scanCount" DESC
        LIMIT 1
      `),
    ]);

    return {
      dailyScans: dailyScansRaw,
      topBrands: topBrandsRaw,
      countryBreakdown: countryScansRaw,
      browserBreakdown: browserScansRaw,
      leaderboards: {
        topBrandAllTime: topBrandAllTimeRaw[0] || null,
        topBrandThisMonth: topBrandThisMonthRaw[0] || null,
        mostScannedBrand: mostScannedBrandRaw[0] || null,
        topTrendingProduct: topTrendingProductRaw[0] || null,
      },
    };
  }

  async listBrands(query: ListBrandsQueryDto) {
    const page = query.page || 1;
    const limit = query.limit || 25;
    const search = query.search?.trim();
    const where: Prisma.OrganisationWhereInput = search
      ? {
          OR: [
            { name: { contains: search, mode: 'insensitive' } },
            { publicSlug: { contains: search, mode: 'insensitive' } },
          ],
        }
      : {};

    const [organisations, total] = await this.prisma.$transaction([
      this.prisma.organisation.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          _count: {
            select: {
              users: {
                where: { role: { in: [Role.OWNER, Role.MANAGER, Role.EDITOR] }, disabledAt: null },
              },
              products: { where: { deletedAt: null } },
            },
          },
        },
      }),
      this.prisma.organisation.count({ where }),
    ]);

    const organisationIds = organisations.map((organisation) => organisation.id);
    const publicationRows = organisationIds.length
      ? await this.prisma.$queryRaw<Array<{ organisationId: string; passports: number; scans: number }>>(Prisma.sql`
          SELECT
            p."organisationId",
            COUNT(DISTINCT pa.id)::int AS passports,
            COUNT(s.id)::int AS scans
          FROM products p
          LEFT JOIN passports pa
            ON pa."productId" = p.id
            AND pa."publishedAt" IS NOT NULL
            AND pa."unpublishedAt" IS NULL
          LEFT JOIN scans s ON s."passportId" = pa.id
          WHERE p."organisationId" IN (${Prisma.join(organisationIds)})
          GROUP BY p."organisationId"
        `)
      : [];
    const publications = new Map(publicationRows.map((row) => [row.organisationId, row]));

    return {
      rows: organisations.map((organisation) => ({
        id: organisation.id,
        name: organisation.name,
        publicSlug: organisation.publicSlug,
        createdAt: organisation.createdAt,
        disabledAt: organisation.disabledAt,
        users: organisation._count.users,
        products: organisation._count.products,
        publishedPassports: publications.get(organisation.id)?.passports ?? 0,
        scans: publications.get(organisation.id)?.scans ?? 0,
      })),
      page,
      limit,
      total,
      pages: Math.max(1, Math.ceil(total / limit)),
    };
  }

  async getBrand(id: string) {
    const organisation = await this.prisma.organisation.findUnique({
      where: { id },
      include: {
        users: {
          where: { role: { in: [Role.OWNER, Role.MANAGER, Role.EDITOR] } },
          select: {
            id: true,
            email: true,
            name: true,
            createdAt: true,
            lastLoginAt: true,
            disabledAt: true,
          },
          orderBy: { createdAt: 'asc' },
        },
        _count: { select: { products: { where: { deletedAt: null } } } },
      },
    });
    if (!organisation) {
      throw new NotFoundException('Brand not found.');
    }
    const [publishedPassports, scans] = await Promise.all([
      this.prisma.passport.count({
        where: { product: { organisationId: id }, publishedAt: { not: null }, unpublishedAt: null },
      }),
      this.prisma.scan.count({ where: { passport: { product: { organisationId: id } } } }),
    ]);
    return {
      ...organisation,
      products: organisation._count.products,
      publishedPassports,
      scans,
      _count: undefined,
    };
  }

  async setBrandStatus(id: string, active: boolean, actorId: string) {
    await this.getBrand(id);
    return this.prisma.$transaction(async (tx) => {
      const organisation = await tx.organisation.update({
        where: { id },
        data: { disabledAt: active ? null : new Date() },
        select: { id: true, name: true, disabledAt: true },
      });
      await tx.auditLogEntry.create({
        data: {
          actorId,
          organisationId: null,
          action: active ? 'BRAND_REACTIVATED' : 'BRAND_SUSPENDED',
          entityType: 'Organisation',
          entityId: id,
          diff: { active },
        },
      });
      return organisation;
    });
  }

  async listPassports(search?: string, page = 1, limit = 25) {
    const where: Prisma.PassportWhereInput = {
      publishedAt: { not: null },
      unpublishedAt: null,
      ...(search
        ? {
            OR: [
              { uuid: { contains: search, mode: 'insensitive' } },
              { product: { name: { contains: search, mode: 'insensitive' } } },
              { product: { sku: { contains: search, mode: 'insensitive' } } },
              { product: { organisation: { name: { contains: search, mode: 'insensitive' } } } },
            ],
          }
        : {}),
    };

    const [passports, total] = await Promise.all([
      this.prisma.passport.findMany({
        where,
        orderBy: { publishedAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          product: {
            select: {
              id: true,
              name: true,
              sku: true,
              serialNumber: true,
              organisation: { select: { id: true, name: true, publicSlug: true } },
            },
          },
          _count: { select: { scans: true } },
          history: { orderBy: { version: 'desc' }, take: 1 },
        },
      }),
      this.prisma.passport.count({ where }),
    ]);

    return {
      rows: passports.map((p) => ({
        id: p.id,
        uuid: p.uuid,
        version: p.version,
        publishedAt: p.publishedAt,
        product: p.product,
        scansCount: p._count.scans,
        latestSnapshot: p.history[0]?.snapshot ?? null,
      })),
      page,
      limit,
      total,
      pages: Math.max(1, Math.ceil(total / limit)),
    };
  }

  async listScans(page = 1, limit = 25) {
    const [scans, total] = await Promise.all([
      this.prisma.scan.findMany({
        orderBy: { timestamp: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          passport: {
            select: {
              uuid: true,
              product: {
                select: {
                  name: true,
                  sku: true,
                  organisation: { select: { name: true } },
                },
              },
            },
          },
        },
      }),
      this.prisma.scan.count(),
    ]);

    return {
      rows: scans.map((s) => ({
        id: s.id,
        timestamp: s.timestamp,
        browser: s.browser,
        os: s.os,
        country: s.country,
        productName: s.passport.product.name,
        productSku: s.passport.product.sku,
        brandName: s.passport.product.organisation.name,
        passportUuid: s.passport.uuid,
      })),
      page,
      limit,
      total,
      pages: Math.max(1, Math.ceil(total / limit)),
    };
  }

  async listAuditLogs(query: AuditLogQueryDto) {
    const { page = 1, limit = 25, search, action, organisationId, from, to } = query;

    const createdAt: Prisma.DateTimeFilter = {};
    if (from) createdAt.gte = new Date(from);
    // `to` is a calendar day from a date input; include everything up to its end.
    if (to) createdAt.lte = new Date(new Date(to).setHours(23, 59, 59, 999));

    const where: Prisma.AuditLogEntryWhereInput = {
      ...(action ? { action } : {}),
      ...(organisationId
        ? { organisationId: organisationId === PLATFORM_SCOPE ? null : organisationId }
        : {}),
      ...(from || to ? { createdAt } : {}),
      ...(search
        ? {
            OR: [
              { entityId: { contains: search, mode: 'insensitive' } },
              { actor: { name: { contains: search, mode: 'insensitive' } } },
              { actor: { email: { contains: search, mode: 'insensitive' } } },
              { organisation: { name: { contains: search, mode: 'insensitive' } } },
            ],
          }
        : {}),
    };

    const [logs, total, actionFacets] = await Promise.all([
      this.prisma.auditLogEntry.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: (page - 1) * limit,
        take: limit,
        include: {
          actor: { select: { name: true, email: true, role: true } },
          organisation: { select: { name: true } },
        },
      }),
      this.prisma.auditLogEntry.count({ where }),
      // Facets ignore the action filter itself so the dropdown never empties out.
      this.prisma.auditLogEntry.groupBy({
        by: ['action'],
        _count: { action: true },
        orderBy: { action: 'asc' },
      }),
    ]);

    const labels = await this.audit.resolveEntityLabels(undefined, logs);

    return {
      rows: logs.map((log) => ({
        ...log,
        entityLabel: labels.get(`${log.entityType}:${log.entityId}`) ?? null,
      })),
      page,
      limit,
      total,
      pages: Math.max(1, Math.ceil(total / limit)),
      facets: {
        actions: actionFacets.map((facet) => ({ action: facet.action, count: facet._count.action })),
      },
    };
  }
}
