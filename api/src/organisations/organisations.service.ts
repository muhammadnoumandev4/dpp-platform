import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { UpdateOrganisationDto } from './dto/organisation.dto';
import { AuditService } from '../audit/audit.service';

@Injectable()
export class OrganisationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async get(organisationId: string) {
    const organisation = await this.prisma.organisation.findUnique({ where: { id: organisationId } });
    if (!organisation) {
      throw new NotFoundException('Organisation not found.');
    }
    return organisation;
  }

  async update(organisationId: string, actorId: string, dto: UpdateOrganisationDto) {
    await this.get(organisationId);
    return this.prisma.$transaction(async (tx) => {
      const organisation = await tx.organisation.update({ where: { id: organisationId }, data: dto });
      await this.audit.log({
        organisationId,
        actorId,
        action: 'ORGANISATION_UPDATED',
        entityType: 'Organisation',
        entityId: organisationId,
        diff: { changedFields: Object.keys(dto) },
      }, tx);
      return organisation;
    });
  }
}
