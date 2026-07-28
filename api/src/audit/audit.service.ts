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

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  log(event: AuditEvent, tx?: Prisma.TransactionClient) {
    return (tx ?? this.prisma).auditLogEntry.create({ data: event });
  }

  async list(organisationId: string, cursor?: string, limit = 25) {
    const rows = await this.prisma.auditLogEntry.findMany({
      where: { organisationId },
      include: { actor: { select: { id: true, name: true, email: true } } },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });
    const hasMore = rows.length > limit;
    const page = hasMore ? rows.slice(0, limit) : rows;
    return { rows: page, nextCursor: hasMore ? page.at(-1)?.id ?? null : null };
  }
}
