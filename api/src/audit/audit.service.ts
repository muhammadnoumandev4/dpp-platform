import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma.service';

export interface AuditEvent {
  organisationId?: string | null;
  actorId: string;
  action: string;
  entityType: string;
  entityId: string;
  diff?: Prisma.InputJsonValue;
}

interface LabelledRow {
  entityType: string;
  entityId: string;
}

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  log(event: AuditEvent, tx?: Prisma.TransactionClient) {
    return (tx ?? this.prisma).auditLogEntry.create({ data: event });
  }

  async list(
    organisationId: string,
    options: { cursor?: string; limit?: number; since?: Date } = {},
  ) {
    const limit = options.limit ?? 25;
    const rows = await this.prisma.auditLogEntry.findMany({
      where: {
        organisationId,
        ...(options.since ? { createdAt: { gte: options.since } } : {}),
      },
      include: { actor: { select: { id: true, name: true, email: true } } },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: limit + 1,
      ...(options.cursor ? { cursor: { id: options.cursor }, skip: 1 } : {}),
    });
    const hasMore = rows.length > limit;
    const page = hasMore ? rows.slice(0, limit) : rows;
    const labels = await this.resolveEntityLabels(organisationId, page);
    return {
      rows: page.map((row) => ({
        ...row,
        entityLabel: labels.get(`${row.entityType}:${row.entityId}`) ?? null,
      })),
      nextCursor: hasMore ? page.at(-1)?.id ?? null : null,
    };
  }

  /**
   * The activity feed reads as sentences ("published the passport for Heritage
   * Denim Jacket"), so every row needs the display name of the thing it touched.
   * Resolved here in one batched query per entity type rather than client-side.
   *
   * `organisationId` scopes the lookup for tenant callers; the platform console
   * reads across every tenant and passes none.
   */
  async resolveEntityLabels(organisationId: string | undefined, rows: LabelledRow[]) {
    const idsByType = new Map<string, Set<string>>();
    for (const row of rows) {
      const bucket = idsByType.get(row.entityType) ?? new Set<string>();
      bucket.add(row.entityId);
      idsByType.set(row.entityType, bucket);
    }

    const labels = new Map<string, string>();
    const remember = (type: string, id: string, label: string | null | undefined) => {
      if (label) labels.set(`${type}:${id}`, label);
    };

    // An undefined organisationId is dropped by Prisma, which is exactly the
    // unscoped, cross-tenant lookup the platform console wants.
    const productIds = idsByType.get('Product');
    if (productIds?.size) {
      // Archived products keep their history, so soft-deleted rows are included.
      const products = await this.prisma.product.findMany({
        where: { id: { in: [...productIds] }, organisationId },
        select: { id: true, name: true },
      });
      products.forEach((product) => remember('Product', product.id, product.name));
    }

    const userIds = idsByType.get('User');
    if (userIds?.size) {
      const users = await this.prisma.user.findMany({
        where: { id: { in: [...userIds] }, organisationId },
        select: { id: true, name: true, email: true },
      });
      users.forEach((user) => remember('User', user.id, user.name || user.email));
    }

    const invitationIds = idsByType.get('Invitation');
    if (invitationIds?.size) {
      const invitations = await this.prisma.invitation.findMany({
        where: { id: { in: [...invitationIds] }, organisationId },
        select: { id: true, email: true },
      });
      invitations.forEach((invitation) => remember('Invitation', invitation.id, invitation.email));
    }

    const organisationIds = idsByType.get('Organisation');
    if (organisationIds?.size) {
      const organisations = await this.prisma.organisation.findMany({
        where: { id: { in: [...organisationIds] } },
        select: { id: true, name: true },
      });
      organisations.forEach((organisation) => remember('Organisation', organisation.id, organisation.name));
    }

    return labels;
  }
}
