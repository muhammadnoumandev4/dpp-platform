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

type BrandSeed = {
  slug: string;
  name: string;
  accentColor: string;
  description: string;
  website: string;
  country: string;
  industry: string;
  suspended?: boolean;
  /** Keep legacy assessment logins on the primary brand. */
  legacyEmails?: boolean;
  skuPrefix: string;
  categoryNames: [string, string];
  productNames: {
    incomplete: string;
    ready: string;
    liveA: string;
    liveB: string;
    unpublished: string;
    archived: string;
    empty: string;
  };
};

const BRANDS: BrandSeed[] = [
  {
    slug: 'notarify',
    name: 'Notarify',
    accentColor: '#157F5C',
    description: 'Traceable apparel passports for modern brands.',
    website: 'https://notarify.test',
    country: 'Portugal',
    industry: 'Apparel',
    legacyEmails: true,
    skuPrefix: 'NTF',
    categoryNames: ['Knitwear', 'Footwear'],
    productNames: {
      incomplete: 'Merino Crew Knit',
      ready: 'Linen Overshirt',
      liveA: 'Trail Runner Low',
      liveB: 'Merino Beanie',
      unpublished: 'Seasonal Scarf (unpublished)',
      archived: 'Archive Cap (soft-deleted)',
      empty: 'Untitled Draft',
    },
  },
  {
    slug: 'atlas-goods',
    name: 'Atlas Goods',
    accentColor: '#1B4F72',
    description: 'Outdoor gear with circular supply chains.',
    website: 'https://atlas-goods.test',
    country: 'Germany',
    industry: 'Outdoor',
    skuPrefix: 'ATL',
    categoryNames: ['Outerwear', 'Packs'],
    productNames: {
      incomplete: 'Shell Jacket (incomplete)',
      ready: 'Trail Pack 28L',
      liveA: 'Alpine Parka',
      liveB: 'Summit Softshell',
      unpublished: 'Rain Cover (unpublished)',
      archived: 'Legacy Tent Pegs (archived)',
      empty: 'New Outerwear Draft',
    },
  },
  {
    slug: 'lumina-home',
    name: 'Lumina Home',
    accentColor: '#8E44AD',
    description: 'Home textiles with material transparency.',
    website: 'https://lumina-home.test',
    country: 'Italy',
    industry: 'Home',
    skuPrefix: 'LUM',
    categoryNames: ['Bedding', 'Tableware'],
    productNames: {
      incomplete: 'Linen Duvet (incomplete)',
      ready: 'Organic Towel Set',
      liveA: 'Stonewashed Sheet Set',
      liveB: 'Ceramic Pour-Over',
      unpublished: 'Seasonal Cushion (unpublished)',
      archived: 'Old Napkin Set (archived)',
      empty: 'Home Draft',
    },
  },
  {
    slug: 'verde-beauty',
    name: 'Verde Beauty',
    accentColor: '#27AE60',
    description: 'Clean beauty with recyclable packaging passports.',
    website: 'https://verde-beauty.test',
    country: 'France',
    industry: 'Beauty',
    skuPrefix: 'VRD',
    categoryNames: ['Skincare', 'Haircare'],
    productNames: {
      incomplete: 'Serum Bottle (incomplete)',
      ready: 'Clay Mask Jar',
      liveA: 'Hydrating Toner',
      liveB: 'Repair Conditioner',
      unpublished: 'Travel Kit (unpublished)',
      archived: 'Discontinued Balm (archived)',
      empty: 'Formula Draft',
    },
  },
  {
    slug: 'harbor-labs',
    name: 'Harbor Labs',
    accentColor: '#7F8C8D',
    description: 'Suspended demo brand — use in admin to test reactivate.',
    website: 'https://harbor-labs.test',
    country: 'Spain',
    industry: 'Electronics',
    suspended: true,
    skuPrefix: 'HBR',
    categoryNames: ['Devices', 'Accessories'],
    productNames: {
      incomplete: 'Sensor Hub (incomplete)',
      ready: 'Cable Kit Ready',
      liveA: 'Beacon Tag',
      liveB: 'Dock Station',
      unpublished: 'Pilot SKU (unpublished)',
      archived: 'Rev A Board (archived)',
      empty: 'Hardware Draft',
    },
  },
];

async function ensureOrganisation(brand: BrandSeed) {
  return prisma.organisation.upsert({
    where: { publicSlug: brand.slug },
    update: {
      name: brand.name,
      accentColor: brand.accentColor,
      description: brand.description,
      website: brand.website,
      country: brand.country,
      industry: brand.industry,
      contactEmail: `hello@${brand.slug}.test`,
      disabledAt: brand.suspended ? new Date('2026-06-01') : null,
    },
    create: {
      name: brand.name,
      publicSlug: brand.slug,
      accentColor: brand.accentColor,
      description: brand.description,
      website: brand.website,
      country: brand.country,
      industry: brand.industry,
      contactEmail: `hello@${brand.slug}.test`,
      disabledAt: brand.suspended ? new Date('2026-06-01') : null,
    },
  });
}

async function seedBrandTeam(
  orgId: string,
  brand: BrandSeed,
  passwordHash: string,
): Promise<{ ownerId: string; managerId: string; editorId: string }> {
  const domain = `${brand.slug.replace(/-/g, '')}.test`;
  const ownerEmail = brand.legacyEmails ? 'editor@notarify.test' : `owner@${domain}`;
  const managerEmail = brand.legacyEmails ? 'manager@notarify.test' : `manager@${domain}`;
  const editorEmail = brand.legacyEmails ? 'member@notarify.test' : `editor@${domain}`;

  const ownerNames: Record<string, string> = {
    notarify: 'J. Meyer',
    'atlas-goods': 'Mara Klein',
    'lumina-home': 'Giulia Rossi',
    'verde-beauty': 'Camille Dupont',
    'harbor-labs': 'Diego Ruiz',
  };

  const owner = await ensureUser({
    email: ownerEmail,
    name: ownerNames[brand.slug] || `${brand.name} Owner`,
    role: Role.OWNER,
    organisationId: orgId,
    passwordHash,
  });
  const manager = await ensureUser({
    email: managerEmail,
    name: `${brand.name} Manager`,
    role: Role.MANAGER,
    organisationId: orgId,
    passwordHash,
  });
  const editor = await ensureUser({
    email: editorEmail,
    name: `${brand.name} Editor`,
    role: Role.EDITOR,
    organisationId: orgId,
    passwordHash,
  });

  // Extra manager/editor aliases for non-legacy brands (clearer admin directory)
  if (!brand.legacyEmails) {
    await ensureUser({
      email: `${brand.skuPrefix.toLowerCase()}.manager@demo.test`,
      name: `${brand.name} Manager 2`,
      role: Role.MANAGER,
      organisationId: orgId,
      passwordHash,
    });
    await ensureUser({
      email: `${brand.skuPrefix.toLowerCase()}.editor@demo.test`,
      name: `${brand.name} Editor 2`,
      role: Role.EDITOR,
      organisationId: orgId,
      passwordHash,
    });
  }

  return { ownerId: owner.id, managerId: manager.id, editorId: editor.id };
}

async function seedBrandCatalog(
  org: { id: string },
  brand: BrandSeed,
  ownerId: string,
): Promise<{ liveSku: string }> {
  await prisma.$transaction((tx) => provisionOrganisationCatalog(tx, org.id));

  const [catA, catB] = await Promise.all([
    category(org.id, brand.categoryNames[0]),
    category(org.id, brand.categoryNames[1]),
  ]);
  const pt = await country(org.id, 'PT', 'Portugal');
  const it = await country(org.id, 'IT', 'Italy');
  const de = await country(org.id, 'DE', 'Germany');
  const fr = await country(org.id, 'FR', 'France');
  const p = brand.skuPrefix;

  // Edge-case / workflow products (MVP coverage)
  await ensureRichProduct({
    organisationId: org.id,
    ownerId,
    sku: brand.legacyEmails ? 'NTF-4192-BLK' : `${p}-INC-001`,
    name: brand.productNames.incomplete,
    serialNumber: `${p}-SN-INC`,
    categoryId: catA.id,
    countryId: pt.id,
    description: `${brand.name}: incomplete draft without cover — test publish blockers.`,
    productionDate: new Date('2026-03-14'),
    materials: [
      { name: 'Primary fibre', percentage: 80, countryId: pt.id, recyclable: true },
      { name: 'Secondary fibre', percentage: 20, countryId: it.id, recyclable: false },
    ],
    sustainability: {
      carbonFootprintKg: 6.4,
      waterConsumptionL: 142,
      recycledPercent: 18,
      repairabilityScore: 8,
      recyclable: true,
    },
  });

  await ensureRichProduct({
    organisationId: org.id,
    ownerId,
    sku: brand.legacyEmails ? 'NTF-READY-001' : `${p}-READY-001`,
    name: brand.productNames.ready,
    serialNumber: `${p}-SN-READY`,
    categoryId: catA.id,
    countryId: pt.id,
    description: `${brand.name}: complete draft — ready to Publish in the UI.`,
    productionDate: new Date('2026-05-01'),
    withCover: true,
    withGallery: true,
    withCerts: true,
    withDocs: true,
    materials: [
      { name: 'Organic material A', percentage: 70, countryId: pt.id, recyclable: true },
      { name: 'Organic material B', percentage: 30, countryId: it.id, recyclable: true },
    ],
    sustainability: {
      carbonFootprintKg: 4.1,
      waterConsumptionL: 95,
      recycledPercent: 10,
      repairabilityScore: 9,
      recyclable: true,
    },
  });

  const liveSku = brand.legacyEmails ? 'NTF-LIVE-100' : `${p}-LIVE-100`;
  await ensureRichProduct({
    organisationId: org.id,
    ownerId,
    sku: liveSku,
    name: brand.productNames.liveA,
    serialNumber: `${p}-SN-LIVE-A`,
    categoryId: catB.id,
    countryId: de.id,
    description: `${brand.name}: flagship published passport with scans, docs, certs, items, versions.`,
    productionDate: new Date('2026-01-20'),
    withCover: true,
    withGallery: true,
    withCerts: true,
    withDocs: true,
    publish: true,
    versionCount: 2,
    scanCount: brand.suspended ? 8 : 36 + (brand.slug.length % 20),
    itemCount: 4,
    materials: [
      { name: 'Recycled content', percentage: 55, countryId: de.id, recyclable: true },
      { name: 'Natural rubber', percentage: 35, countryId: pt.id, recyclable: false },
      { name: 'Organic lining', percentage: 10, countryId: it.id, recyclable: true },
    ],
    sustainability: {
      carbonFootprintKg: 9.2,
      waterConsumptionL: 210,
      recycledPercent: 55,
      repairabilityScore: 7,
      recyclable: true,
    },
  });

  await ensureRichProduct({
    organisationId: org.id,
    ownerId,
    sku: brand.legacyEmails ? 'NTF-LIVE-200' : `${p}-LIVE-200`,
    name: brand.productNames.liveB,
    serialNumber: `${p}-SN-LIVE-B`,
    categoryId: catA.id,
    countryId: fr.id,
    description: `${brand.name}: second live passport for dashboard ranking / most-viewed.`,
    productionDate: new Date('2026-02-02'),
    withCover: true,
    withGallery: true,
    withDocs: true,
    publish: true,
    versionCount: 1,
    scanCount: brand.suspended ? 4 : 22 + (p.charCodeAt(0) % 15),
    itemCount: 2,
    materials: [
      { name: 'Merino wool', percentage: 100, countryId: pt.id, recyclable: true },
    ],
    sustainability: {
      carbonFootprintKg: 3.8,
      waterConsumptionL: 70,
      recycledPercent: 0,
      repairabilityScore: 8,
      recyclable: true,
    },
  });

  await ensureRichProduct({
    organisationId: org.id,
    ownerId,
    sku: brand.legacyEmails ? 'NTF-OFF-300' : `${p}-OFF-300`,
    name: brand.productNames.unpublished,
    serialNumber: `${p}-SN-OFF`,
    categoryId: catA.id,
    countryId: pt.id,
    description: `${brand.name}: published then unpublished — public URL withdrawn.`,
    productionDate: new Date('2026-02-10'),
    withCover: true,
    withCerts: true,
    publish: true,
    unpublish: true,
    versionCount: 1,
    scanCount: 5,
    materials: [{ name: 'Merino wool', percentage: 100, countryId: pt.id, recyclable: true }],
    sustainability: {
      carbonFootprintKg: 3.3,
      waterConsumptionL: 80,
      recycledPercent: 0,
      repairabilityScore: 8,
      recyclable: true,
    },
  });

  await ensureRichProduct({
    organisationId: org.id,
    ownerId,
    sku: brand.legacyEmails ? 'NTF-ARCH-200' : `${p}-ARCH-200`,
    name: brand.productNames.archived,
    serialNumber: `${p}-SN-ARCH`,
    categoryId: catA.id,
    countryId: it.id,
    description: `${brand.name}: soft-deleted product for archive behaviour.`,
    productionDate: new Date('2025-11-01'),
    deletedAt: new Date('2026-07-01'),
    withCover: true,
    materials: [{ name: 'Organic cotton', percentage: 100, countryId: it.id, recyclable: true }],
    sustainability: {
      carbonFootprintKg: 1.2,
      waterConsumptionL: 40,
      recycledPercent: 0,
      repairabilityScore: 6,
      recyclable: true,
    },
  });

  await ensureRichProduct({
    organisationId: org.id,
    ownerId,
    sku: brand.legacyEmails ? 'NTF-EMPTY-400' : `${p}-EMPTY-400`,
    name: brand.productNames.empty,
    serialNumber: `${p}-SN-EMPTY`,
    categoryId: catA.id,
    countryId: pt.id,
    description: `${brand.name}: minimal draft for edit experiments.`,
    productionDate: new Date('2026-07-01'),
    materials: [{ name: 'Cotton', percentage: 100, countryId: pt.id, recyclable: true }],
    sustainability: {
      carbonFootprintKg: 2,
      waterConsumptionL: 50,
      recycledPercent: 0,
      repairabilityScore: 5,
      recyclable: true,
    },
  });

  const inviteEmail = `invitee@${brand.slug}.test`;
  const pendingInvite = await prisma.invitation.findFirst({
    where: { organisationId: org.id, email: inviteEmail, acceptedAt: null },
  });
  if (!pendingInvite) {
    await prisma.invitation.create({
      data: {
        email: inviteEmail,
        role: Role.EDITOR,
        organisationId: org.id,
        token: randomUUID(),
        invitedById: ownerId,
        expiresAt: new Date(Date.now() + 7 * 86_400_000),
      },
    });
  }

  return { liveSku };
}

async function main() {
  const passwordHash = await bcrypt.hash(PASSWORD, 12);

  const admin = await ensureUser({
    email: 'admin@notarify.test',
    name: 'Ana Ferreira',
    role: Role.ADMIN,
    passwordHash,
  });

  const liveUrls: string[] = [];
  const accountLines: string[] = [
    '  admin@notarify.test              ADMIN     → /admin (all brands)',
  ];

  for (const brand of BRANDS) {
    const org = await ensureOrganisation(brand);
    const team = await seedBrandTeam(org.id, brand, passwordHash);
    const { liveSku } = await seedBrandCatalog(org, brand, team.ownerId);

    const passport = await prisma.passport.findFirst({
      where: { product: { organisationId: org.id, sku: liveSku } },
      select: { uuid: true },
    });
    if (passport) {
      liveUrls.push(`  ${brand.name}: ${WEB_URL}/passport/${passport.uuid}?src=qr`);
    }

    if (brand.legacyEmails) {
      accountLines.push('  editor@notarify.test             OWNER     → Notarify');
      accountLines.push('  manager@notarify.test            MANAGER   → Notarify');
      accountLines.push('  member@notarify.test             EDITOR    → Notarify');
    } else {
      const domain = `${brand.slug.replace(/-/g, '')}.test`;
      const flag = brand.suspended ? ' (SUSPENDED)' : '';
      accountLines.push(`  owner@${domain}    OWNER     → ${brand.name}${flag}`);
      accountLines.push(`  manager@${domain}  MANAGER   → ${brand.name}${flag}`);
      accountLines.push(`  editor@${domain}   EDITOR    → ${brand.name}${flag}`);
    }

    const adminAudit = await prisma.auditLogEntry.findFirst({
      where: { actorId: admin.id, entityId: org.id, action: { in: ['BRAND_SEEDED', 'BRAND_SUSPENDED'] } },
    });
    if (!adminAudit) {
      await prisma.auditLogEntry.create({
        data: {
          organisationId: null,
          actorId: admin.id,
          action: brand.suspended ? 'BRAND_SUSPENDED' : 'BRAND_SEEDED',
          entityType: 'Organisation',
          entityId: org.id,
          diff: { seeded: true, slug: brand.slug },
        },
      });
    }
  }

  // Legacy alias kept for older README snippets — Manager on Atlas (one OWNER max per brand).
  await ensureUser({
    email: 'atlas.owner@atlas.test',
    name: 'Mara Klein (alias)',
    role: Role.MANAGER,
    organisationId: (await prisma.organisation.findUniqueOrThrow({ where: { publicSlug: 'atlas-goods' } })).id,
    passwordHash,
  });

  console.log('Seed complete — multi-brand MVP demo data.');
  console.log(`Password for all demo users: ${PASSWORD}`);
  console.log(`Brands: ${BRANDS.length} (1 suspended for admin reactivate test)`);
  console.log('Accounts:');
  for (const line of accountLines) console.log(line);
  console.log('Per brand products: incomplete, ready-to-publish, 2× live+scans, unpublished, soft-deleted, empty draft');
  console.log('Live public passports:');
  for (const line of liveUrls) console.log(line);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
