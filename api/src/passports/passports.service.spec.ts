import { NotFoundException } from '@nestjs/common';
import { PassportsService } from './passports.service';

describe('PassportsService version history', () => {
  const passportFindFirst = jest.fn();
  const versionFindMany = jest.fn();
  const versionFindUnique = jest.fn();

  const service = new PassportsService(
    {
      passport: { findFirst: passportFindFirst },
      passportVersion: { findMany: versionFindMany, findUnique: versionFindUnique },
    } as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    { log: jest.fn() } as never,
  );

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('lists versions newest-first and scopes passport ownership to the organisation', async () => {
    passportFindFirst.mockResolvedValue({ id: 'passport-1', uuid: 'uuid-1' });
    versionFindMany.mockResolvedValue([{ id: 'pv-2', version: 2 }]);

    await expect(service.listVersions('org-1', 'product-1')).resolves.toEqual([
      { id: 'pv-2', version: 2 },
    ]);

    expect(passportFindFirst).toHaveBeenCalledWith({
      where: {
        productId: 'product-1',
        product: { organisationId: 'org-1' },
      },
      select: { id: true, uuid: true, product: { select: { sku: true } } },
    });
    expect(versionFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { passportId: 'passport-1' },
        orderBy: { version: 'desc' },
      }),
    );
  });

  it('returns one immutable snapshot without reading the live product', async () => {
    passportFindFirst.mockResolvedValue({ id: 'passport-1', uuid: 'uuid-1' });
    versionFindUnique.mockResolvedValue({
      id: 'pv-1',
      version: 1,
      snapshot: { name: 'Published name' },
    });

    await expect(service.getVersion('org-1', 'product-1', 1)).resolves.toEqual({
      passportId: 'passport-1',
      uuid: 'uuid-1',
      id: 'pv-1',
      version: 1,
      snapshot: { name: 'Published name' },
    });
    expect(versionFindUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { passportId_version: { passportId: 'passport-1', version: 1 } },
      }),
    );
  });

  it('does not reveal whether another tenant has passport versions', async () => {
    passportFindFirst.mockResolvedValue(null);

    await expect(service.listVersions('other-org', 'product-1')).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(versionFindMany).not.toHaveBeenCalled();
  });

  it('does not report a version for a passport row that has never been published', async () => {
    const product = {
      id: 'product-1',
      updatedAt: new Date('2026-07-28T10:00:00.000Z'),
      passport: {
        uuid: 'uuid-1',
        version: 0,
        publishedAt: null,
        unpublishedAt: null,
        qrUrl: null,
      },
    };
    const products = {
      findOne: jest.fn().mockResolvedValue(product),
      evaluatePublishBlockers: jest.fn().mockReturnValue([]),
    };
    const statusService = new PassportsService(
      {} as never,
      products as never,
      {} as never,
      {} as never,
      {} as never,
      { log: jest.fn() } as never,
    );

    await expect(statusService.getPublishStatus('org-1', 'product-1')).resolves.toEqual({
      blockers: [],
      isPublished: false,
      hasUnpublishedChanges: false,
      currentVersion: null,
      publishedAt: null,
      uuid: 'uuid-1',
      qrUrl: null,
    });
  });
});
