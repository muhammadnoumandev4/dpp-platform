import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ProductsService } from './products.service';

function buildPrismaMock(overrides: Record<string, any> = {}) {
  const prisma = {
    product: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      create: jest.fn(),
      count: jest.fn(),
      findMany: jest.fn(),
    },
    productImage: {
      deleteMany: jest.fn(),
      updateMany: jest.fn(),
      count: jest.fn(),
      create: jest.fn(),
    },
    certification: { deleteMany: jest.fn(), count: jest.fn(), create: jest.fn() },
    document: { deleteMany: jest.fn(), count: jest.fn(), create: jest.fn() },
    passport: { update: jest.fn() },
    category: { findFirst: jest.fn() },
    country: { count: jest.fn() },
    ...overrides,
  };
  (prisma as any).$transaction =
    overrides.$transaction ??
    jest.fn(async (fn: any) => (typeof fn === 'function' ? fn(prisma) : Promise.all(fn)));
  return prisma;
}

function buildService(prisma: ReturnType<typeof buildPrismaMock>) {
  return new ProductsService(
    prisma as any,
    { log: jest.fn().mockResolvedValue({}) } as any,
    { deletePrefix: jest.fn().mockResolvedValue(undefined) } as any,
  );
}

const BASE_PRODUCT = {
  id: 'product-1',
  organisationId: 'org-1',
  name: 'Merino Crew Knit',
  sku: 'NTF-4192-BLK',
  categoryId: 'cat-1',
  serialNumber: 'SN-1',
  productionDate: new Date(),
  countryOfOriginId: 'country-1',
  materials: [{ percentage: 100 }],
  sustainability: {
    carbonFootprintKg: 6.4,
    waterConsumptionL: 142,
    recycledPercent: 18,
    repairabilityScore: 8,
    recyclable: true,
  },
  images: [{ isCover: true }],
};

describe('ProductsService.getPublishBlockers', () => {
  it('returns no blockers for a fully complete product', async () => {
    const prisma = buildPrismaMock();
    prisma.product.findFirst.mockResolvedValue(BASE_PRODUCT);
    const service = buildService(prisma);

    const blockers = await service.getPublishBlockers('org-1', 'product-1');
    expect(blockers).toEqual([]);
  });

  it('flags a missing cover image with a stable code', async () => {
    const prisma = buildPrismaMock();
    prisma.product.findFirst.mockResolvedValue({ ...BASE_PRODUCT, images: [] });
    const service = buildService(prisma);

    const blockers = await service.getPublishBlockers('org-1', 'product-1');
    expect(blockers).toContainEqual(expect.objectContaining({ code: 'COVER_IMAGE_MISSING', path: 'images' }));
  });

  it('flags a missing country of origin', async () => {
    const prisma = buildPrismaMock();
    prisma.product.findFirst.mockResolvedValue({ ...BASE_PRODUCT, countryOfOriginId: null });
    const service = buildService(prisma);

    const blockers = await service.getPublishBlockers('org-1', 'product-1');
    expect(blockers).toContainEqual(expect.objectContaining({ code: 'COUNTRY_OF_ORIGIN_MISSING', path: 'general' }));
  });

  it('flags materials that do not total 100%', async () => {
    const prisma = buildPrismaMock();
    prisma.product.findFirst.mockResolvedValue({ ...BASE_PRODUCT, materials: [{ percentage: 60 }] });
    const service = buildService(prisma);

    const blockers = await service.getPublishBlockers('org-1', 'product-1');
    expect(blockers).toContainEqual(expect.objectContaining({ code: 'MATERIAL_TOTAL', path: 'materials' }));
  });

  it('flags incomplete sustainability fields', async () => {
    const prisma = buildPrismaMock();
    prisma.product.findFirst.mockResolvedValue({
      ...BASE_PRODUCT,
      sustainability: {
        carbonFootprintKg: 6.4,
        waterConsumptionL: null,
        recycledPercent: null,
        repairabilityScore: null,
        recyclable: false,
      },
    });
    const service = buildService(prisma);

    const blockers = await service.getPublishBlockers('org-1', 'product-1');
    expect(blockers.map((b) => b.code)).toEqual(
      expect.arrayContaining([
        'WATER_CONSUMPTION_MISSING',
        'RECYCLED_PERCENT_MISSING',
        'REPAIRABILITY_SCORE_MISSING',
      ]),
    );
  });

  it('throws NotFoundException for a product outside the caller organisation', async () => {
    const prisma = buildPrismaMock();
    prisma.product.findFirst.mockResolvedValue(null);
    const service = buildService(prisma);

    await expect(service.getPublishBlockers('org-1', 'someone-elses-product')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});

describe('ProductsService full-text search', () => {
  it('uses ranked SQL ids while preserving result order', async () => {
    const prisma = buildPrismaMock();
    (prisma as any).$queryRaw = jest
      .fn()
      .mockResolvedValueOnce([{ id: 'product-2' }, { id: 'product-1' }])
      .mockResolvedValueOnce([{ count: BigInt(2) }]);
    prisma.product.findMany.mockResolvedValue([
      { ...BASE_PRODUCT, id: 'product-1', updatedAt: new Date(), passport: null },
      { ...BASE_PRODUCT, id: 'product-2', updatedAt: new Date(), passport: null },
    ]);
    const service = buildService(prisma);

    const result = await service.list('org-1', { search: 'merino', page: 1, limit: 25 });

    expect((prisma as any).$queryRaw).toHaveBeenCalledTimes(2);
    expect(result.rows.map((row) => row.id)).toEqual(['product-2', 'product-1']);
    expect(result.total).toBe(2);
  });
});

describe('ProductsService unpublished-change tracking', () => {

  it('archives the authoring record without withdrawing its issued passport', async () => {
    const prisma = buildPrismaMock({
      passport: { update: jest.fn().mockResolvedValue({}) },
    });
    prisma.product.findFirst.mockResolvedValue({
      ...BASE_PRODUCT,
      passport: {
        id: 'passport-1',
        publishedAt: new Date('2026-01-01'),
        unpublishedAt: null,
      },
    });
    prisma.product.update.mockResolvedValue(BASE_PRODUCT);
    const service = buildService(prisma);

    await expect(service.softDelete('org-1', 'product-1', 'actor-1')).resolves.toEqual({
      success: true,
      passportPreserved: true,
    });

    expect(prisma.passport.update).not.toHaveBeenCalled();
    expect(prisma.product.update).toHaveBeenCalledWith({
      where: { id: 'product-1' },
      data: { deletedAt: expect.any(Date), updatedAt: expect.any(Date) },
    });
  });
});
