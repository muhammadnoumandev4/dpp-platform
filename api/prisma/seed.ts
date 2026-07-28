import { PrismaClient, Role } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { provisionOrganisationCatalog } from '../src/taxonomy/catalog.constants';

const prisma = new PrismaClient();

async function main() {
  const org = await prisma.organisation.upsert({
    where: { publicSlug: 'notarify' },
    update: {},
    create: { name: 'Notarify', publicSlug: 'notarify' },
  });

  const passwordHash = await bcrypt.hash('password123', 12);
  await prisma.$transaction((tx) => provisionOrganisationCatalog(tx, org.id));

  // Legacy code block removed, as employees are now in User table

  await prisma.user.upsert({
    where: { email: 'admin@notarify.test' },
    update: { passwordHash, name: 'Ana Ferreira', role: Role.ADMIN, disabledAt: null },
    create: {
      email: 'admin@notarify.test',
      passwordHash,
      name: 'Ana Ferreira',
      role: Role.ADMIN,
    },
  });

  await prisma.user.upsert({
    where: { email: 'editor@notarify.test' },
    update: { role: Role.OWNER },
    create: {
      email: 'editor@notarify.test',
      passwordHash,
      name: 'J. Meyer',
      role: Role.OWNER,
      organisationId: org.id,
    },
  });

  const apparel = await prisma.category.upsert({
    where: { organisationId_name: { organisationId: org.id, name: 'Knitwear' } },
    update: {},
    create: { organisationId: org.id, name: 'Knitwear' },
  });

  const portugal = await prisma.country.upsert({
    where: { organisationId_code: { organisationId: org.id, code: 'PT' } },
    update: {},
    create: { organisationId: org.id, name: 'Portugal', code: 'PT' },
  });
  const italy = await prisma.country.upsert({
    where: { organisationId_code: { organisationId: org.id, code: 'IT' } },
    update: {},
    create: { organisationId: org.id, name: 'Italy', code: 'IT' },
  });

  const existingProduct = await prisma.product.findFirst({
    where: { organisationId: org.id, sku: 'NTF-4192-BLK', deletedAt: null },
    select: { id: true },
  });
  if (!existingProduct) {
    await prisma.product.create({
      data: {
        organisationId: org.id,
        name: 'Merino Crew Knit',
        sku: 'NTF-4192-BLK',
        serialNumber: 'SN-0021749',
        categoryId: apparel.id,
        description:
          'A mid-weight crew-neck knit in traceable extra-fine merino, knitted in northern Portugal. Fully recyclable and repairable through the take-back scheme.',
        productionDate: new Date('2026-03-14'),
        countryOfOriginId: portugal.id,
        materials: {
          create: [
            {
              name: 'Extra-fine merino wool',
              percentage: 82,
              countryOfOriginId: portugal.id,
              recyclable: true,
              sortOrder: 0,
            },
            {
              name: 'Recycled polyamide',
              percentage: 18,
              countryOfOriginId: italy.id,
              recyclable: false,
              sortOrder: 1,
            },
          ],
        },
        sustainability: {
          create: { carbonFootprintKg: 6.4, waterConsumptionL: 142, recycledPercent: 18, repairabilityScore: 8, recyclable: true },
        },
      },
    });
  }

  console.log('Seed complete. Brand: editor@notarify.test. Platform admin: admin@notarify.test. Password: password123.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
