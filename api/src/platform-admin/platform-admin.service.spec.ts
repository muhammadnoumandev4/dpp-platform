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
    const service = new PlatformAdminService(prisma as never);

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
    const service = new PlatformAdminService(prisma as never);

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
});
