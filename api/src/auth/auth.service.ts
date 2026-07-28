import { ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Prisma, Role } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { randomBytes } from 'crypto';
import { PrismaService } from '../prisma.service';
import { getPermissions } from './permissions';
import { LoginDto, RegisterBrandDto } from './dto/auth.dto';
import { provisionOrganisationCatalog } from '../taxonomy/catalog.constants';

@Injectable()
export class AuthService {
  constructor(private readonly prisma: PrismaService, private readonly jwt: JwtService) {}

  async login(dto: LoginDto) {
    const email = dto.email.trim().toLowerCase();
    const user = await this.prisma.user.findUnique({
      where: { email },
      include: { organisation: { select: { disabledAt: true } } },
    });
    if (!user || user.disabledAt || (user.organisation && user.organisation.disabledAt)) {
      throw new UnauthorizedException('Invalid email or password.');
    }

    const valid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!valid) {
      throw new UnauthorizedException('Invalid email or password.');
    }

    await this.prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });

    const token = this.jwt.sign({ sub: user.id, role: user.role, organisationId: user.organisationId });
    const { passwordHash, organisation, ...safeUser } = user;
    const userWithPermissions = { ...safeUser, permissions: getPermissions(user.role as Role) };
    return { accessToken: token, user: userWithPermissions };
  }

  async registerBrand(dto: RegisterBrandDto) {
    const email = dto.email.trim().toLowerCase();
    const existingUser = await this.prisma.user.findUnique({
      where: { email },
      select: { id: true },
    });
    if (existingUser) {
      throw new ConflictException('An account with this email already exists.');
    }

    const baseSlug = this.toPublicSlug(dto.brandName);
    const slugExists = await this.prisma.organisation.findUnique({
      where: { publicSlug: baseSlug },
      select: { id: true },
    });
    const publicSlug = slugExists ? `${baseSlug}-${randomBytes(3).toString('hex')}` : baseSlug;
    const passwordHash = await bcrypt.hash(dto.password, 12);

    try {
      const user = await this.prisma.$transaction(async (tx) => {
        const organisation = await tx.organisation.create({
          data: {
            name: dto.brandName.trim(),
            publicSlug,
          },
        });
        await provisionOrganisationCatalog(tx, organisation.id);
        const administrator = await tx.user.create({
          data: {
            organisationId: organisation.id,
            name: dto.name.trim(),
            email,
            passwordHash,
            // Brand signup always creates the tenant OWNER. Platform ADMIN
            // accounts are seeded/provisioned separately and never created here.
            role: Role.OWNER,
          },
        });
        await tx.auditLogEntry.create({
          data: {
            organisationId: organisation.id,
            actorId: administrator.id,
            action: 'BRAND_REGISTERED',
            entityType: 'Organisation',
            entityId: organisation.id,
            diff: { name: organisation.name, publicSlug: organisation.publicSlug },
          },
        });
        return administrator;
      });

      const accessToken = this.jwt.sign({
        sub: user.id,
        role: user.role,
        organisationId: user.organisationId,
      });
      const { passwordHash: _passwordHash, ...safeUser } = user;
      const userWithPermissions = { ...safeUser, permissions: getPermissions(user.role as Role) };
      return { accessToken, user: userWithPermissions };
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('That email or brand URL is already in use. Please try again.');
      }
      throw error;
    }
  }

  private toPublicSlug(value: string) {
    const slug = value
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 60)
      .replace(/-+$/g, '');
    return slug || `brand-${randomBytes(3).toString('hex')}`;
  }
}
