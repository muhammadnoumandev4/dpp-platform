import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma.service';
import { AuditService } from '../audit/audit.service';
import { AcceptInvitationDto, CreateInvitationDto } from './dto/invitation.dto';

const INVITATION_TTL_DAYS = 7;

@Injectable()
export class InvitationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async list(organisationId: string) {
    return this.prisma.invitation.findMany({
      where: { organisationId, acceptedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async create(organisationId: string, invitedById: string, dto: CreateInvitationDto) {
    const email = dto.email.trim().toLowerCase();
    const existingUser = await this.prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      throw new ConflictException('A user with this email already exists.');
    }

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + INVITATION_TTL_DAYS);

    return this.prisma.$transaction(async (tx) => {
      const pending = await tx.invitation.findFirst({
        where: { organisationId, email, acceptedAt: null },
      });
      if (pending && pending.expiresAt > new Date()) {
        throw new ConflictException('An active invitation for this email already exists.');
      }
      if (pending) {
        await tx.invitation.delete({ where: { id: pending.id } });
      }
      const invitation = await tx.invitation.create({
        data: {
          email,
          role: dto.role,
          organisationId,
          invitedById,
          token: randomUUID(),
          expiresAt,
        },
      });
      await this.audit.log({
        organisationId,
        actorId: invitedById,
        action: 'INVITATION_CREATED',
        entityType: 'Invitation',
        entityId: invitation.id,
        diff: { email: invitation.email, role: invitation.role },
      }, tx);
      return invitation;
    });
  }

  async getByToken(token: string) {
    const invitation = await this.prisma.invitation.findUnique({
      where: { token },
      include: { organisation: { select: { name: true } } },
    });
    if (!invitation || invitation.acceptedAt || invitation.expiresAt < new Date()) {
      throw new NotFoundException('This invitation is invalid or has expired.');
    }
    return {
      email: invitation.email,
      role: invitation.role,
      expiresAt: invitation.expiresAt,
      organisation: invitation.organisation,
    };
  }

  async accept(token: string, dto: AcceptInvitationDto) {
    // Reject random/expired tokens before paying the bcrypt cost. The
    // invitation is locked and revalidated below for race safety.
    await this.getByToken(token);
    const passwordHash = await bcrypt.hash(dto.password, 12);

    return this.prisma.$transaction(async (tx) => {
      const [locked] = await tx.$queryRaw<Array<{ id: string }>>`
        SELECT id FROM invitations WHERE token = ${token} FOR UPDATE
      `;
      if (!locked) {
        throw new NotFoundException('This invitation is invalid or has expired.');
      }

      const invitation = await tx.invitation.findUnique({ where: { id: locked.id } });
      if (!invitation || invitation.acceptedAt || invitation.expiresAt < new Date()) {
        throw new NotFoundException('This invitation is invalid or has expired.');
      }

      const existingUser = await tx.user.findUnique({ where: { email: invitation.email } });
      if (existingUser) {
        throw new BadRequestException('An account with this email already exists.');
      }

      const user = await tx.user.create({
        data: {
          email: invitation.email,
          passwordHash,
          name: dto.name,
          role: invitation.role,
          organisationId: invitation.organisationId,
        },
      });
      await tx.invitation.update({ where: { id: invitation.id }, data: { acceptedAt: new Date() } });
      await this.audit.log({
        organisationId: user.organisationId,
        actorId: user.id,
        action: 'INVITATION_ACCEPTED',
        entityType: 'User',
        entityId: user.id,
        diff: { email: user.email },
      }, tx);
      return {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        organisationId: user.organisationId,
      };
    });
  }
}
