import {
  DocumentType,
  PrismaClient,
  ProductStatus,
  Role,
  ScanSource,
} from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { createHash, randomUUID } from 'crypto';
import { mkdir, writeFile } from 'fs/promises';
import { dirname, join } from 'path';
import * as QRCode from 'qrcode';
import { provisionOrganisationCatalog } from '../src/taxonomy/catalog.constants';

const prisma = new PrismaClient();

const PASSWORD = 'password123';
const WEB_URL = process.env.WEB_PUBLIC_URL || 'http://localhost:3001';
const API_URL = process.env.PUBLIC_BASE_URL || 'http://localhost:3000';
const UPLOAD_DIR = process.env.UPLOAD_DIR || join(process.cwd(), 'uploads');

/** 1×1 PNG — enough for cover/gallery seeds and media serving. */
const TINY_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
);

/** Minimal valid-enough PDF header for download demos. */
const TINY_PDF = Buffer.from(
  '%PDF-1.1\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n',
  'utf8',
);

async function putFile(key: string, buffer: Buffer) {
  const destination = join(UPLOAD_DIR, key);
  await mkdir(dirname(destination), { recursive: true });
  try {
    await writeFile(destination, buffer, { flag: 'wx' });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
  }
  return `${API_URL}/uploads/${key}`;
}

async function putQr(organisationId: string, url: string) {
  const key = `${organisationId}/qr/${randomUUID()}.png`;
  const buffer = await QRCode.toBuffer(url, { width: 512, margin: 2 });
  const publicUrl = await putFile(key, buffer);
  return { key, url: publicUrl };
}

async function ensureUser(input: {
  email: string;
  name: string;
  role: Role;
  organisationId?: string | null;
  passwordHash: string;
}) {
  return prisma.user.upsert({
    where: { email: input.email },
    update: {
      passwordHash: input.passwordHash,
      name: input.name,
      role: input.role,
      organisationId: input.organisationId ?? null,
      disabledAt: null,
    },
    create: {
      email: input.email,
      passwordHash: input.passwordHash,
      name: input.name,
      role: input.role,
      organisationId: input.organisationId ?? null,
    },
  });
}

async function country(orgId: string, code: string, name: string) {
  return prisma.country.upsert({
    where: { organisationId_code: { organisationId: orgId, code } },
    update: { name },
    create: { organisationId: orgId, code, name },
  });
}

async function category(orgId: string, name: string) {
  return prisma.category.upsert({
    where: { organisationId_name: { organisationId: orgId, name } },
    update: {},
    create: { organisationId: orgId, name },
  });
}

type SeedProductOpts = {
  organisationId: string;
  ownerId: string;
  sku: string;
  name: string;
  serialNumber?: string;
  categoryId: string;
  countryId: string;
  description: string;
  productionDate: Date;
  status?: ProductStatus;
  deletedAt?: Date | null;
  materials: { name: string; percentage: number; countryId: string; recyclable: boolean }[];
  sustainability: {
    carbonFootprintKg: number;
    waterConsumptionL: number;
    recycledPercent: number;
    repairabilityScore: number;
    recyclable: boolean;
  };
  withCover?: boolean;
  withGallery?: boolean;
  withCerts?: boolean;
  withDocs?: boolean;
  publish?: boolean;
  unpublish?: boolean;
  versionCount?: number;
  scanCount?: number;
  itemCount?: number;
};

async function ensureRichProduct(opts: SeedProductOpts) {
  const existing = await prisma.product.findFirst({
    where: { organisationId: opts.organisationId, sku: opts.sku },
    include: { passport: true, images: true },
  });
  if (existing) return existing;

  const product = await prisma.product.create({
    data: {
      organisationId: opts.organisationId,
      name: opts.name,
      sku: opts.sku,
      serialNumber: opts.serialNumber ?? null,
      categoryId: opts.categoryId,
      description: opts.description,
      productionDate: opts.productionDate,
      countryOfOriginId: opts.countryId,
      status: opts.status ?? ProductStatus.DRAFT,
      deletedAt: opts.deletedAt ?? null,
      sustainability: { create: opts.sustainability },
    },
  });

  await prisma.material.createMany({
    data: opts.materials.map((m, i) => ({
      productId: product.id,
      organisationId: opts.organisationId,
      name: m.name,
      percentage: m.percentage,
      countryOfOriginId: m.countryId,
      recyclable: m.recyclable,
      sortOrder: i,
    })),
  });

  if (opts.withCover) {
    const key = `${opts.organisationId}/images/${product.id}-cover.png`;
    await putFile(key, TINY_PNG);
    await prisma.productImage.create({
      data: { productId: product.id, fileKey: key, isCover: true, altText: 'Cover', sortOrder: 0 },
    });
  }

  if (opts.withGallery) {
    for (let i = 1; i <= 2; i++) {
      const key = `${opts.organisationId}/images/${product.id}-gallery-${i}.png`;
      await putFile(key, TINY_PNG);
      await prisma.productImage.create({
        data: {
          productId: product.id,
          fileKey: key,
          isCover: false,
          altText: `Gallery ${i}`,
          sortOrder: i,
        },
      });
    }
  }

  if (opts.withCerts) {
    const certKey = `${opts.organisationId}/certs/${product.id}-got.pdf`;
    await putFile(certKey, TINY_PDF);
    await prisma.certification.create({
      data: {
        productId: product.id,
        name: 'GOTS Organic',
        issuingAuthority: 'Control Union',
        issueDate: new Date('2025-06-01'),
        expiryDate: new Date('2027-06-01'),
        fileKey: certKey,
        fileName: 'gots-certificate.pdf',
        sortOrder: 0,
      },
    });
  }

  if (opts.withDocs) {
    const docs: { type: DocumentType; label: string }[] = [
      { type: DocumentType.MANUAL, label: 'user-manual.pdf' },
      { type: DocumentType.WARRANTY, label: 'warranty.pdf' },
      { type: DocumentType.DATASHEET, label: 'datasheet.pdf' },
    ];
    for (const [i, doc] of docs.entries()) {
      const key = `${opts.organisationId}/documents/${product.id}-${doc.label}`;
      await putFile(key, TINY_PDF);
      await prisma.document.create({
        data: {
          productId: product.id,
          type: doc.type,
          fileKey: key,
          fileName: doc.label,
          sizeBytes: TINY_PDF.length,
          sortOrder: i,
        },
      });
    }
  }

  if (!opts.publish) {
    return prisma.product.findFirstOrThrow({
      where: { id: product.id },
      include: { passport: true, images: true },
    });
  }

  const full = await prisma.product.findFirstOrThrow({
    where: { id: product.id },
    include: {
      category: true,
      countryOfOrigin: true,
      materials: { include: { countryOfOrigin: true }, orderBy: { sortOrder: 'asc' } },
      sustainability: true,
      certifications: { orderBy: { sortOrder: 'asc' } },
      documents: { orderBy: { sortOrder: 'asc' } },
      images: { orderBy: { sortOrder: 'asc' } },
      organisation: {
        select: { id: true, name: true, publicSlug: true, logoUrl: true, accentColor: true, website: true },
      },
    },
  });

  const passport = await prisma.passport.create({ data: { productId: product.id } });
  const publicUrl = `${WEB_URL}/passport/${passport.uuid}`;
  const qr = await putQr(opts.organisationId, `${publicUrl}?src=qr`);
  const versions = Math.max(1, opts.versionCount ?? 1);
  let publishedAt = new Date(Date.now() - versions * 86_400_000);

  for (let v = 1; v <= versions; v++) {
    publishedAt = new Date(Date.now() - (versions - v + 1) * 86_400_000);
    const snapshot =
      v === versions
        ? full
        : {
            ...full,
            name: `${opts.name} (v${v})`,
            description: `${opts.description} — historical snapshot v${v}.`,
          };
    await prisma.passportVersion.create({
      data: {
        passportId: passport.id,
        organisationId: opts.organisationId,
        version: v,
        snapshot,
        publishedById: opts.ownerId,
        publishedAt,
      },
    });
  }

  await prisma.passport.update({
    where: { id: passport.id },
    data: {
      version: versions,
      publishedAt,
      unpublishedAt: opts.unpublish ? new Date() : null,
      qrKey: qr.key,
      qrUrl: qr.url,
    },
  });

  await prisma.product.update({
    where: { id: product.id },
    data: {
      status: opts.unpublish || opts.deletedAt ? ProductStatus.DRAFT : ProductStatus.PUBLISHED,
      updatedAt: publishedAt,
    },
  });

  if (opts.itemCount && opts.itemCount > 0) {
    for (let i = 1; i <= opts.itemCount; i++) {
      const item = await prisma.productItem.create({
        data: {
          passportId: passport.id,
          serialNumber: `${opts.sku}-${String(i).padStart(6, '0')}`,
          batchId: 'SEED-BATCH-01',
        },
      });
      const itemQr = await putQr(opts.organisationId, `${WEB_URL}/passport/i/${item.id}?src=qr`);
      await prisma.productItem.update({
        where: { id: item.id },
        data: { qrKey: itemQr.key, qrUrl: itemQr.url },
      });
    }
  }

  const scanCount = opts.scanCount ?? 0;
  const countries = ['IT', 'PT', 'DE', 'FR', 'ES', 'US', 'GB', 'NL'];
  const browsers = ['Chrome', 'Safari', 'Firefox', 'Edge'];
  const oses = ['iOS', 'Android', 'macOS', 'Windows'];
  for (let i = 0; i < scanCount; i++) {
    const daysAgo = i % 14;
    const ts = new Date();
    ts.setDate(ts.getDate() - daysAgo);
    ts.setHours(10 + (i % 8), i % 60, 0, 0);
    const ip = `203.0.113.${(i % 200) + 1}`;
    await prisma.scan.create({
      data: {
        passportId: passport.id,
        timestamp: ts,
        source: i % 3 === 0 ? ScanSource.DIRECT : ScanSource.QR,
        ipHash: createHash('sha256').update(`seed:${ip}`).digest('hex'),
        ipTruncated: ip.replace(/\.\d+$/, '.xxx'),
        browser: browsers[i % browsers.length],
        os: oses[i % oses.length],
        browserLanguage: i % 2 === 0 ? 'en-GB' : 'it-IT',
        country: countries[i % countries.length],
        referrer: i % 4 === 0 ? 'https://instagram.com/' : null,
        dedupKey: `seed-${passport.id}-${i}`,
      },
    });
  }

  await prisma.auditLogEntry.create({
    data: {
      organisationId: opts.organisationId,
      actorId: opts.ownerId,
      action: 'PASSPORT_PUBLISHED',
      entityType: 'Product',
      entityId: product.id,
      diff: { version: versions, uuid: passport.uuid, seeded: true },
    },
  });

  return prisma.product.findFirstOrThrow({
    where: { id: product.id },
    include: { passport: true, images: true },
  });
}

async function main() {
  const passwordHash = await bcrypt.hash(PASSWORD, 12);

  const notarify = await prisma.organisation.upsert({
    where: { publicSlug: 'notarify' },
    update: {
      name: 'Notarify',
      accentColor: '#157F5C',
      description: 'Traceable apparel passports for modern brands.',
      contactEmail: 'hello@notarify.test',
      website: 'https://notarify.test',
      country: 'Portugal',
      industry: 'Apparel',
      disabledAt: null,
    },
    create: {
      name: 'Notarify',
      publicSlug: 'notarify',
      accentColor: '#157F5C',
      description: 'Traceable apparel passports for modern brands.',
      contactEmail: 'hello@notarify.test',
      website: 'https://notarify.test',
      country: 'Portugal',
      industry: 'Apparel',
    },
  });

  const atlas = await prisma.organisation.upsert({
    where: { publicSlug: 'atlas-goods' },
    update: {
      name: 'Atlas Goods',
      accentColor: '#1B4F72',
      description: 'Outdoor gear with circular supply chains.',
      website: 'https://atlas-goods.test',
      country: 'Germany',
      industry: 'Outdoor',
      disabledAt: null,
    },
    create: {
      name: 'Atlas Goods',
      publicSlug: 'atlas-goods',
      accentColor: '#1B4F72',
      description: 'Outdoor gear with circular supply chains.',
      website: 'https://atlas-goods.test',
      country: 'Germany',
      industry: 'Outdoor',
    },
  });

  await prisma.$transaction((tx) => provisionOrganisationCatalog(tx, notarify.id));
  await prisma.$transaction((tx) => provisionOrganisationCatalog(tx, atlas.id));

  const admin = await ensureUser({
    email: 'admin@notarify.test',
    name: 'Ana Ferreira',
    role: Role.ADMIN,
    passwordHash,
  });
  const owner = await ensureUser({
    email: 'editor@notarify.test',
    name: 'J. Meyer',
    role: Role.OWNER,
    organisationId: notarify.id,
    passwordHash,
  });
  await ensureUser({
    email: 'manager@notarify.test',
    name: 'Sofia Costa',
    role: Role.MANAGER,
    organisationId: notarify.id,
    passwordHash,
  });
  await ensureUser({
    email: 'member@notarify.test',
    name: 'Luis Rocha',
    role: Role.EDITOR,
    organisationId: notarify.id,
    passwordHash,
  });
  await ensureUser({
    email: 'atlas.owner@atlas.test',
    name: 'Mara Klein',
    role: Role.OWNER,
    organisationId: atlas.id,
    passwordHash,
  });

  const knitwear = await category(notarify.id, 'Knitwear');
  const footwear = await category(notarify.id, 'Footwear');
  const portugal = await country(notarify.id, 'PT', 'Portugal');
  const italy = await country(notarify.id, 'IT', 'Italy');
  const germany = await country(notarify.id, 'DE', 'Germany');

  const atlasOuterwear = await category(atlas.id, 'Outerwear');
  const atlasDe = await country(atlas.id, 'DE', 'Germany');
  const atlasPt = await country(atlas.id, 'PT', 'Portugal');

  // 1) Incomplete draft — publish blockers (no cover)
  await ensureRichProduct({
    organisationId: notarify.id,
    ownerId: owner.id,
    sku: 'NTF-4192-BLK',
    name: 'Merino Crew Knit',
    serialNumber: 'SN-0021749',
    categoryId: knitwear.id,
    countryId: portugal.id,
    description:
      'A mid-weight crew-neck knit in traceable extra-fine merino. Seeded without a cover image so you can test publish blockers.',
    productionDate: new Date('2026-03-14'),
    materials: [
      { name: 'Extra-fine merino wool', percentage: 82, countryId: portugal.id, recyclable: true },
      { name: 'Recycled polyamide', percentage: 18, countryId: italy.id, recyclable: false },
    ],
    sustainability: {
      carbonFootprintKg: 6.4,
      waterConsumptionL: 142,
      recycledPercent: 18,
      repairabilityScore: 8,
      recyclable: true,
    },
  });

  // 2) Complete draft — ready to publish in the UI
  await ensureRichProduct({
    organisationId: notarify.id,
    ownerId: owner.id,
    sku: 'NTF-READY-001',
    name: 'Linen Overshirt',
    serialNumber: 'SN-READY-001',
    categoryId: knitwear.id,
    countryId: portugal.id,
    description: 'Fully completed draft with cover, materials and sustainability — ready to Publish.',
    productionDate: new Date('2026-05-01'),
    withCover: true,
    withGallery: true,
    withCerts: true,
    withDocs: true,
    materials: [
      { name: 'Organic linen', percentage: 70, countryId: portugal.id, recyclable: true },
      { name: 'Organic cotton', percentage: 30, countryId: italy.id, recyclable: true },
    ],
    sustainability: {
      carbonFootprintKg: 4.1,
      waterConsumptionL: 95,
      recycledPercent: 0,
      repairabilityScore: 9,
      recyclable: true,
    },
  });

  // 3) Live published passport + analytics + inventory items + version history
  const live = await ensureRichProduct({
    organisationId: notarify.id,
    ownerId: owner.id,
    sku: 'NTF-LIVE-100',
    name: 'Trail Runner Low',
    serialNumber: 'SN-LIVE-100',
    categoryId: footwear.id,
    countryId: portugal.id,
    description:
      'Published seed product with certifications, documents, gallery, QR, unit items and scan history for analytics.',
    productionDate: new Date('2026-01-20'),
    withCover: true,
    withGallery: true,
    withCerts: true,
    withDocs: true,
    publish: true,
    versionCount: 2,
    scanCount: 48,
    itemCount: 5,
    materials: [
      { name: 'Recycled PET mesh', percentage: 55, countryId: germany.id, recyclable: true },
      { name: 'Natural rubber', percentage: 35, countryId: portugal.id, recyclable: false },
      { name: 'Organic cotton lining', percentage: 10, countryId: italy.id, recyclable: true },
    ],
    sustainability: {
      carbonFootprintKg: 9.2,
      waterConsumptionL: 210,
      recycledPercent: 55,
      repairabilityScore: 7,
      recyclable: true,
    },
  });

  // 4) Soft-deleted archive (still listed as deleted / hidden from live lists)
  await ensureRichProduct({
    organisationId: notarify.id,
    ownerId: owner.id,
    sku: 'NTF-ARCH-200',
    name: 'Archive Cap (soft-deleted)',
    serialNumber: 'SN-ARCH-200',
    categoryId: knitwear.id,
    countryId: italy.id,
    description: 'Soft-deleted product for testing archive behaviour.',
    productionDate: new Date('2025-11-01'),
    deletedAt: new Date('2026-07-01'),
    withCover: true,
    materials: [
      { name: 'Organic cotton', percentage: 100, countryId: italy.id, recyclable: true },
    ],
    sustainability: {
      carbonFootprintKg: 1.2,
      waterConsumptionL: 40,
      recycledPercent: 0,
      repairabilityScore: 6,
      recyclable: true,
    },
  });

  // 5) Published then unpublished — public passport withdrawn
  await ensureRichProduct({
    organisationId: notarify.id,
    ownerId: owner.id,
    sku: 'NTF-OFF-300',
    name: 'Seasonal Scarf (unpublished)',
    serialNumber: 'SN-OFF-300',
    categoryId: knitwear.id,
    countryId: portugal.id,
    description: 'Was published, then unpublished — public URL should not resolve.',
    productionDate: new Date('2026-02-10'),
    withCover: true,
    withCerts: true,
    publish: true,
    unpublish: true,
    versionCount: 1,
    scanCount: 6,
    materials: [
      { name: 'Merino wool', percentage: 100, countryId: portugal.id, recyclable: true },
    ],
    sustainability: {
      carbonFootprintKg: 3.3,
      waterConsumptionL: 80,
      recycledPercent: 0,
      repairabilityScore: 8,
      recyclable: true,
    },
  });

  // 6) Bare draft — empty-ish for create/edit flows
  await ensureRichProduct({
    organisationId: notarify.id,
    ownerId: owner.id,
    sku: 'NTF-EMPTY-400',
    name: 'Untitled Draft',
    categoryId: knitwear.id,
    countryId: portugal.id,
    description: 'Minimal draft for editing experiments.',
    productionDate: new Date('2026-07-01'),
    serialNumber: 'SN-EMPTY-400',
    materials: [
      { name: 'Cotton', percentage: 100, countryId: portugal.id, recyclable: true },
    ],
    sustainability: {
      carbonFootprintKg: 2,
      waterConsumptionL: 50,
      recycledPercent: 0,
      repairabilityScore: 5,
      recyclable: true,
    },
  });

  // Second brand — platform admin multi-tenant console
  await ensureRichProduct({
    organisationId: atlas.id,
    ownerId: (
      await prisma.user.findUniqueOrThrow({ where: { email: 'atlas.owner@atlas.test' } })
    ).id,
    sku: 'ATL-PARKA-01',
    name: 'Alpine Parka',
    serialNumber: 'ATL-SN-01',
    categoryId: atlasOuterwear.id,
    countryId: atlasDe.id,
    description: 'Second-brand published product for platform-admin cross-tenant views.',
    productionDate: new Date('2026-04-12'),
    withCover: true,
    withDocs: true,
    publish: true,
    versionCount: 1,
    scanCount: 12,
    materials: [
      { name: 'Recycled nylon', percentage: 80, countryId: atlasDe.id, recyclable: true },
      { name: 'Organic cotton', percentage: 20, countryId: atlasPt.id, recyclable: true },
    ],
    sustainability: {
      carbonFootprintKg: 11.5,
      waterConsumptionL: 160,
      recycledPercent: 80,
      repairabilityScore: 8,
      recyclable: true,
    },
  });

  const pendingInvite = await prisma.invitation.findFirst({
    where: { organisationId: notarify.id, email: 'invitee@notarify.test', acceptedAt: null },
  });
  if (!pendingInvite) {
    await prisma.invitation.create({
      data: {
        email: 'invitee@notarify.test',
        role: Role.EDITOR,
        organisationId: notarify.id,
        token: randomUUID(),
        invitedById: owner.id,
        expiresAt: new Date(Date.now() + 7 * 86_400_000),
      },
    });
  }

  const seededAudit = await prisma.auditLogEntry.findFirst({
    where: { action: 'PRODUCT_CREATED', entityId: live.id },
  });
  if (!seededAudit) {
    await prisma.auditLogEntry.createMany({
      data: [
        {
          organisationId: notarify.id,
          actorId: owner.id,
          action: 'PRODUCT_CREATED',
          entityType: 'Product',
          entityId: live.id,
          diff: { seeded: true },
        },
        {
          organisationId: null,
          actorId: admin.id,
          action: 'BRAND_VIEWED',
          entityType: 'Organisation',
          entityId: notarify.id,
          diff: { seeded: true },
        },
      ],
    });
  }

  const livePassport = await prisma.passport.findFirst({
    where: { product: { sku: 'NTF-LIVE-100' } },
    select: { uuid: true },
  });

  console.log('Seed complete.');
  console.log(`Password for all demo users: ${PASSWORD}`);
  console.log('Accounts:');
  console.log('  admin@notarify.test     ADMIN     → /admin');
  console.log('  editor@notarify.test    OWNER     → brand back office');
  console.log('  manager@notarify.test   MANAGER');
  console.log('  member@notarify.test    EDITOR');
  console.log('  atlas.owner@atlas.test  OWNER     → Atlas Goods');
  console.log('Products (Notarify): incomplete draft, ready-to-publish, live+scans, soft-deleted, unpublished, empty draft');
  if (livePassport) {
    console.log(`Live public passport: ${WEB_URL}/passport/${livePassport.uuid}?src=qr`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
