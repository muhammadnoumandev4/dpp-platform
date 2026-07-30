import { AuditService } from './audit.service';

describe('AuditService', () => {
  it('writes an organisation-scoped event', async () => {
    const prisma = { auditLogEntry: { create: jest.fn().mockResolvedValue({ id: 'event-1' }) } };
    const service = new AuditService(prisma as never);
    const event = {
      organisationId: 'org-1',
      actorId: 'user-1',
      action: 'PRODUCT_CREATED',
      entityType: 'Product',
      entityId: 'product-1',
    };

    await service.log(event);
    expect(prisma.auditLogEntry.create).toHaveBeenCalledWith({ data: event });
  });

  it('never lists another organisation and returns a cursor', async () => {
    const rows = Array.from({ length: 3 }, (_, index) => ({
      id: `event-${index}`,
      entityType: 'Product',
      entityId: 'product-1',
    }));
    const prisma = {
      auditLogEntry: { findMany: jest.fn().mockResolvedValue(rows) },
      product: { findMany: jest.fn().mockResolvedValue([]) },
    };
    const service = new AuditService(prisma as never);

    await expect(service.list('org-1', { limit: 2 })).resolves.toEqual({
      rows: rows.slice(0, 2).map((row) => ({ ...row, entityLabel: null })),
      nextCursor: 'event-1',
    });
    expect(prisma.auditLogEntry.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { organisationId: 'org-1' }, take: 3 }),
    );
  });

  it('applies since as a createdAt lower bound', async () => {
    const since = new Date('2026-07-01T00:00:00.000Z');
    const prisma = {
      auditLogEntry: { findMany: jest.fn().mockResolvedValue([]) },
    };
    const service = new AuditService(prisma as never);

    await service.list('org-1', { since });

    expect(prisma.auditLogEntry.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { organisationId: 'org-1', createdAt: { gte: since } },
      }),
    );
  });

  it('labels each row with the display name of the entity it touched', async () => {
    const prisma = {
      auditLogEntry: {
        findMany: jest.fn().mockResolvedValue([
          { id: 'event-0', entityType: 'Product', entityId: 'product-1' },
          { id: 'event-1', entityType: 'User', entityId: 'user-1' },
          { id: 'event-2', entityType: 'Product', entityId: 'gone' },
        ]),
      },
      product: { findMany: jest.fn().mockResolvedValue([{ id: 'product-1', name: 'Heritage Denim Jacket' }]) },
      user: { findMany: jest.fn().mockResolvedValue([{ id: 'user-1', name: 'Bilal Ahmed', email: 'b@x.test' }]) },
    };
    const service = new AuditService(prisma as never);

    const result = await service.list('org-1');

    expect(result.rows.map((row) => row.entityLabel)).toEqual(['Heritage Denim Jacket', 'Bilal Ahmed', null]);
    // One batched query per entity type, scoped to the caller's organisation.
    expect(prisma.product.findMany).toHaveBeenCalledTimes(1);
    expect(prisma.product.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: { in: ['product-1', 'gone'] }, organisationId: 'org-1' } }),
    );
  });
});
