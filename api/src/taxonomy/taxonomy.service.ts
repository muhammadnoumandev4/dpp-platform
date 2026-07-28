import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';

@Injectable()
export class TaxonomyService {
  constructor(private readonly prisma: PrismaService) {}

  categories(organisationId: string) {
    return this.prisma.category.findMany({ where: { organisationId, archivedAt: null }, orderBy: { name: 'asc' } });
  }

  countries(organisationId: string) {
    return this.prisma.country.findMany({ where: { organisationId }, orderBy: { name: 'asc' } });
  }

  materialPresets(organisationId: string) {
    return this.prisma.materialPreset.findMany({
      where: { organisationId },
      orderBy: [{ group: 'asc' }, { name: 'asc' }],
    });
  }
}
