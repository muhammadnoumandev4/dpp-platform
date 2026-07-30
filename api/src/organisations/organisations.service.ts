import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma.service';
import { UpdateOrganisationDto } from './dto/organisation.dto';
import { AuditService } from '../audit/audit.service';
import { CacheService } from '../cache/cache.service';
import { CacheKeys } from '../cache/cache.keys';

@Injectable()
export class OrganisationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly cache: CacheService,
  ) {}

  async get(organisationId: string) {
    const organisation = await this.prisma.organisation.findUnique({ where: { id: organisationId } });
    if (!organisation) {
      throw new NotFoundException('Organisation not found.');
    }
    return organisation;
  }

  async update(organisationId: string, actorId: string, dto: UpdateOrganisationDto) {
    const before = await this.get(organisationId);
    const organisation = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.organisation.update({ where: { id: organisationId }, data: dto });
      // Same shape as PRODUCT_UPDATED so the activity feed can render before → after.
      const changed = Object.fromEntries(
        Object.keys(dto).map((field) => [
          field,
          {
            from: JSON.parse(JSON.stringify(before[field as keyof typeof before] ?? null)) as unknown,
            to: JSON.parse(JSON.stringify(dto[field as keyof UpdateOrganisationDto] ?? null)) as unknown,
          },
        ]),
      );
      await this.audit.log({
        organisationId,
        actorId,
        action: 'ORGANISATION_UPDATED',
        entityType: 'Organisation',
        entityId: organisationId,
        diff: { changedFields: Object.keys(dto), changed } as Prisma.InputJsonValue,
      }, tx);
      return updated;
    });

    // Public passports live-join brand name/logo/accent into a cached response.
    await this.invalidateBrandFacingCaches(organisationId);
    return organisation;
  }

  private async invalidateBrandFacingCaches(organisationId: string) {
    const passports = await this.prisma.passport.findMany({
      where: { product: { organisationId } },
      select: { uuid: true },
    });
    await Promise.all([
      ...passports.map((passport) => this.cache.delete(CacheKeys.passport(passport.uuid))),
      this.cache.deletePrefix(CacheKeys.dashboard(organisationId)),
      this.cache.deletePrefix(CacheKeys.analyticsPrefix(organisationId)),
    ]);
  }
}
