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
    const rows = Array.from({ length: 3 }, (_, index) => ({ id: `event-${index}` }));
    const prisma = { auditLogEntry: { findMany: jest.fn().mockResolvedValue(rows) } };
    const service = new AuditService(prisma as never);

    await expect(service.list('org-1', undefined, 2)).resolves.toEqual({
      rows: rows.slice(0, 2),
      nextCursor: 'event-1',
    });
    expect(prisma.auditLogEntry.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { organisationId: 'org-1' }, take: 3 }),
    );
  });
});
