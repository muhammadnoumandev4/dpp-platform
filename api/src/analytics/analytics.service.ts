import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { CacheService } from '../cache/cache.service';

interface MostViewedRow {
  id: string;
  name: string;
  sku: string;
  views: bigint;
}

interface DailyCountRow {
  day: Date;
  count: bigint;
}

export interface DailySeriesPoint {
  date: string;
  count: number;
}

@Injectable()
export class AnalyticsService {
  constructor(private readonly prisma: PrismaService, private readonly cache: CacheService) {}

  async dashboard(organisationId: string) {
    return this.cache.getOrSet(`dashboard:${organisationId}`, 30, () => this.loadDashboard(organisationId));
  }

  private async loadDashboard(organisationId: string) {
    const [totalProducts, publishedPassports, generatedQrCodes, scanCount, mostViewed] = await Promise.all([
      this.prisma.product.count({ where: { organisationId, deletedAt: null } }),
      this.prisma.passport.count({ where: { product: { organisationId }, publishedAt: { not: null }, unpublishedAt: null } }),
      this.countGeneratedQrCodes(organisationId),
      this.prisma.scan.count({ where: { passport: { product: { organisationId } } } }),
      this.getMostViewedProducts(organisationId, 5),
    ]);

    return {
      totalProducts,
      publishedPassports,
      generatedQrCodes,
      totalPassportViews: scanCount,
      mostViewed,
    };
  }

  /** Product passport QRs plus per-item QRs that have actually been minted. */
  private async countGeneratedQrCodes(organisationId: string) {
    const [passportQrs, itemQrs] = await Promise.all([
      this.prisma.passport.count({
        where: {
          product: { organisationId },
          qrKey: { not: null },
        },
      }),
      this.prisma.productItem.count({
        where: {
          passport: { product: { organisationId } },
          qrKey: { not: null },
        },
      }),
    ]);
    return passportQrs + itemQrs;
  }

  async overview(organisationId: string, days = 30) {
    return this.cache.getOrSet(`analytics:${organisationId}:${days}`, 60, () => this.loadOverview(organisationId, days));
  }

  private async loadOverview(organisationId: string, days: number) {
    const now = new Date();
    const startOfToday = new Date(now);
    startOfToday.setHours(0, 0, 0, 0);
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - 7);

    const baseWhere = { passport: { product: { organisationId } } };

    const [scansToday, scansThisWeek, mostViewed, latestScans, dailySeries] = await Promise.all([
      this.prisma.scan.count({ where: { ...baseWhere, timestamp: { gte: startOfToday } } }),
      this.prisma.scan.count({ where: { ...baseWhere, timestamp: { gte: startOfWeek } } }),
      this.getMostViewedProducts(organisationId, 5),
      this.prisma.scan.findMany({
        where: baseWhere,
        // Explicit select: ipHash/ipTruncated stay server-side, they are not tenant data.
        select: {
          id: true,
          timestamp: true,
          browser: true,
          os: true,
          browserLanguage: true,
          country: true,
          source: true,
          passport: { select: { uuid: true, product: { select: { name: true, sku: true } } } },
        },
        orderBy: { timestamp: 'desc' },
        take: 20,
      }),
      this.getDailySeries(organisationId, days),
    ]);

    return { scansToday, scansThisWeek, mostViewed, latestScans, dailySeries };
  }

  /**
   * True top-N by view count via GROUP BY/ORDER BY/LIMIT in SQL — the
   * previous version fetched an arbitrary 5 published products and sorted
   * them client-side, which silently dropped genuinely popular products
   * outside that arbitrary page.
   */
  private async getMostViewedProducts(organisationId: string, limit: number) {
    const rows = await this.prisma.$queryRaw<MostViewedRow[]>`
      SELECT p.id, p.name, p.sku, COUNT(s.id)::bigint AS views
      FROM products p
      JOIN passports pp ON pp."productId" = p.id
      LEFT JOIN scans s ON s."passportId" = pp.id
      WHERE p."organisationId" = ${organisationId}
        AND p."deletedAt" IS NULL
        AND p.status = 'PUBLISHED'
      GROUP BY p.id, p.name, p.sku
      ORDER BY views DESC
      LIMIT ${limit}
    `;
    return rows.map((row) => ({ id: row.id, name: row.name, sku: row.sku, views: Number(row.views) }));
  }

  /**
   * Zero-filled daily scan counts for the trend chart — `GROUP BY` on its
   * own silently omits days with no scans, which would make the chart's
   * x-axis skip gaps instead of showing a real flat zero.
   */
  private async getDailySeries(organisationId: string, days: number): Promise<DailySeriesPoint[]> {
    const rows = await this.prisma.$queryRaw<DailyCountRow[]>`
      SELECT date_trunc('day', s."timestamp") AS day, COUNT(*)::bigint AS count
      FROM scans s
      JOIN passports pp ON pp.id = s."passportId"
      JOIN products p ON p.id = pp."productId"
      WHERE p."organisationId" = ${organisationId}
        AND s."timestamp" >= now() - (${days}::text || ' days')::interval
      GROUP BY day
    `;
    const countByDay = new Map(rows.map((row) => [row.day.toISOString().slice(0, 10), Number(row.count)]));

    const series: DailySeriesPoint[] = [];
    for (let i = days - 1; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const key = date.toISOString().slice(0, 10);
      series.push({ date: key, count: countByDay.get(key) ?? 0 });
    }
    return series;
  }
}
