import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Role } from '@prisma/client';
import { PrismaService } from '../prisma.service';
import { AuditService } from '../audit/audit.service';

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  list(organisationId: string) {
    return this.prisma.user.findMany({
      where: { organisationId, disabledAt: null },
      select: { id: true, email: true, name: true, role: true, avatarUrl: true, lastLoginAt: true, createdAt: true },
      orderBy: { createdAt: 'asc' },
    });
  }

  async remove(organisationId: string, userId: string, requestingUserId: string) {
    if (userId === requestingUserId) {
      throw new BadRequestException('You cannot remove your own account.');
    }

    await this.prisma.$transaction(async (tx) => {
      const target = await tx.user.findFirst({ where: { id: userId, organisationId, disabledAt: null } });
      if (!target) {
        throw new NotFoundException('User not found.');
      }
      if (target.role === Role.OWNER) {
        throw new ForbiddenException('The brand owner cannot be removed. Transfer ownership first.');
      }

      await tx.user.update({ where: { id: userId }, data: { disabledAt: new Date() } });
      await this.audit.log({
        organisationId,
        actorId: requestingUserId,
        action: 'USER_DEACTIVATED',
        entityType: 'User',
        entityId: userId,
      }, tx);
    });
    return { success: true };
  }
}
