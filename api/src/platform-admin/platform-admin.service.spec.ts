import { PlatformAdminService } from './platform-admin.service';

describe('PlatformAdminService', () => {
  it('returns global operational totals, including suspended brands', async () => {
    const prisma = {
      organisation: { count: jest.fn().mockResolvedValueOnce(5).mockResolvedValueOnce(4) },
      user: { count: jest.fn().mockResolvedValue(7) },
      product: { count: jest.fn().mockResolvedValue(20) },
      passport: { count: jest.fn().mockResolvedValue(12) },
      scan: { count: jest.fn().mockResolvedValue(300) },
    };
    const service = new PlatformAdminService(prisma as never, { resolveEntityLabels: jest.fn() } as never);

    await expect(service.overview()).resolves.toEqual({
      brands: 5,
      activeBrands: 4,
      suspendedBrands: 1,
      brandUsers: 7,
      products: 20,
      publishedPassports: 12,
      scans: 300,
    });
  });

  it('suspends a brand without deleting its products or passports', async () => {
    const tx = {
      organisation: {
        update: jest.fn().mockResolvedValue({
          id: 'org-1',
          name: 'Brand',
          disabledAt: new Date(),
        }),
      },
      auditLogEntry: { create: jest.fn().mockResolvedValue({}) },
    };
    const prisma = {
      organisation: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'org-1',
          name: 'Brand',
          users: [],
          _count: { products: 2 },
        }),
      },
      passport: { count: jest.fn().mockResolvedValue(1) },
      scan: { count: jest.fn().mockResolvedValue(2) },
      $transaction: jest.fn(async (callback: (client: typeof tx) => unknown) => callback(tx)),
    };
    const service = new PlatformAdminService(prisma as never, { resolveEntityLabels: jest.fn() } as never);

    await service.setBrandStatus('org-1', false, 'admin-1');

    expect(tx.organisation.update).toHaveBeenCalledWith({
      where: { id: 'org-1' },
      data: { disabledAt: expect.any(Date) },
      select: { id: true, name: true, disabledAt: true },
    });
    expect(tx.auditLogEntry.create).toHaveBeenCalledWith({
      data: {
        actorId: 'admin-1',
        organisationId: null,
        action: 'BRAND_SUSPENDED',
        entityType: 'Organisation',
        entityId: 'org-1',
        diff: { active: false },
      },
    });
  });

  describe('listAuditLogs', () => {
    function auditPrisma() {
      return {
        auditLogEntry: {
          findMany: jest.fn().mockResolvedValue([
            { id: 'event-1', action: 'PRODUCT_UPDATED', entityType: 'Product', entityId: 'product-1' },
          ]),
          count: jest.fn().mockResolvedValue(31),
          groupBy: jest.fn().mockResolvedValue([{ action: 'PRODUCT_UPDATED', _count: { action: 4 } }]),
        },
      };
    }

    it('paginates, facets and labels each entry', async () => {
      const prisma = auditPrisma();
      const audit = { resolveEntityLabels: jest.fn().mockResolvedValue(new Map([['Product:product-1', 'Alpine Parka']])) };
      const service = new PlatformAdminService(prisma as never, audit as never);

      const result = await service.listAuditLogs({ page: 2, limit: 10 } as never);

      expect(prisma.auditLogEntry.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: {}, skip: 10, take: 10 }),
      );
      expect(result.rows[0].entityLabel).toBe('Alpine Parka');
      expect(result).toMatchObject({ page: 2, total: 31, pages: 4 });
      expect(result.facets.actions).toEqual([{ action: 'PRODUCT_UPDATED', count: 4 }]);
      // Cross-tenant: the console must not scope label lookups to one organisation.
      expect(audit.resolveEntityLabels).toHaveBeenCalledWith(undefined, expect.any(Array));
    });

    it('reads the platform scope as entries without an organisation', async () => {
      const prisma = auditPrisma();
      const service = new PlatformAdminService(prisma as never, { resolveEntityLabels: jest.fn().mockResolvedValue(new Map()) } as never);

      await service.listAuditLogs({ organisationId: 'platform', action: 'BRAND_SUSPENDED' } as never);

      expect(prisma.auditLogEntry.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { action: 'BRAND_SUSPENDED', organisationId: null } }),
      );
    });

    it('covers the whole of the end day in a date range', async () => {
      const prisma = auditPrisma();
      const service = new PlatformAdminService(prisma as never, { resolveEntityLabels: jest.fn().mockResolvedValue(new Map()) } as never);

      await service.listAuditLogs({ from: '2026-07-01', to: '2026-07-31' } as never);

      const { where } = prisma.auditLogEntry.findMany.mock.calls[0][0];
      expect(where.createdAt.gte).toEqual(new Date('2026-07-01'));
      expect(where.createdAt.lte.getHours()).toBe(23);
    });
  });
});
