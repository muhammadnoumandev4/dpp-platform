import { Prisma } from '@prisma/client';

export const CATEGORY_CATALOG = [
  'Tops',
  'Bottoms',
  'Dresses',
  'Outerwear',
  'Knitwear',
  'Accessories',
  'Bags',
  'Footwear',
  'Swimwear',
  'Activewear',
  'Underwear',
  'Sleepwear',
  'Other',
] as const;

export const MATERIAL_CATALOG = [
  { group: 'Cotton', name: 'Organic Cotton' },
  { group: 'Cotton', name: 'Cotton' },
  { group: 'Cotton', name: 'Recycled Cotton' },
  { group: 'Plant-based fibers', name: 'Linen' },
  { group: 'Plant-based fibers', name: 'Hemp' },
  { group: 'Plant-based fibers', name: 'Bamboo' },
  { group: 'Wool & animal fibers', name: 'Wool' },
  { group: 'Wool & animal fibers', name: 'Merino Wool' },
  { group: 'Wool & animal fibers', name: 'Cashmere' },
  { group: 'Wool & animal fibers', name: 'Silk' },
  { group: 'Synthetics', name: 'Polyester' },
  { group: 'Synthetics', name: 'Recycled Polyester' },
  { group: 'Synthetics', name: 'Nylon' },
  { group: 'Synthetics', name: 'Recycled Nylon' },
  { group: 'Synthetics', name: 'Elastane' },
  { group: 'Synthetics', name: 'Spandex' },
  { group: 'Cellulosic fibers', name: 'Viscose' },
  { group: 'Cellulosic fibers', name: 'Modal' },
  { group: 'Cellulosic fibers', name: 'Tencel/Lyocell' },
  { group: 'Leather', name: 'Leather' },
  { group: 'Leather', name: 'Full Grain Leather' },
  { group: 'Leather', name: 'Top Grain Leather' },
  { group: 'Leather', name: 'Genuine Leather' },
  { group: 'Leather', name: 'Suede' },
  { group: 'Leather', name: 'Vegan Leather' },
] as const;

export const COUNTRY_CATALOG = [
  ['AF', 'Afghanistan'], ['AL', 'Albania'], ['DZ', 'Algeria'], ['AD', 'Andorra'],
  ['AR', 'Argentina'], ['AM', 'Armenia'], ['AU', 'Australia'], ['AT', 'Austria'],
  ['AZ', 'Azerbaijan'], ['BD', 'Bangladesh'], ['BY', 'Belarus'], ['BE', 'Belgium'],
  ['BA', 'Bosnia and Herzegovina'], ['BR', 'Brazil'], ['BG', 'Bulgaria'], ['KH', 'Cambodia'],
  ['CA', 'Canada'], ['CL', 'Chile'], ['CN', 'China'], ['CO', 'Colombia'], ['HR', 'Croatia'],
  ['CY', 'Cyprus'], ['CZ', 'Czech Republic'], ['DK', 'Denmark'], ['EC', 'Ecuador'],
  ['EG', 'Egypt'], ['EE', 'Estonia'], ['ET', 'Ethiopia'], ['FI', 'Finland'], ['FR', 'France'],
  ['GE', 'Georgia'], ['DE', 'Germany'], ['GH', 'Ghana'], ['GR', 'Greece'], ['GT', 'Guatemala'],
  ['HN', 'Honduras'], ['HK', 'Hong Kong'], ['HU', 'Hungary'], ['IS', 'Iceland'], ['IN', 'India'],
  ['ID', 'Indonesia'], ['IE', 'Ireland'], ['IL', 'Israel'], ['IT', 'Italy'], ['JP', 'Japan'],
  ['JO', 'Jordan'], ['KE', 'Kenya'], ['XK', 'Kosovo'], ['LV', 'Latvia'], ['LI', 'Liechtenstein'],
  ['LT', 'Lithuania'], ['LU', 'Luxembourg'], ['MY', 'Malaysia'], ['MT', 'Malta'], ['MX', 'Mexico'],
  ['MD', 'Moldova'], ['MC', 'Monaco'], ['ME', 'Montenegro'], ['MA', 'Morocco'], ['NP', 'Nepal'],
  ['MK', 'North Macedonia'], ['NL', 'Netherlands'], ['NZ', 'New Zealand'], ['NG', 'Nigeria'],
  ['NO', 'Norway'], ['PK', 'Pakistan'], ['PA', 'Panama'], ['PE', 'Peru'], ['PH', 'Philippines'],
  ['PL', 'Poland'], ['PT', 'Portugal'], ['RO', 'Romania'], ['RU', 'Russia'], ['SM', 'San Marino'],
  ['SA', 'Saudi Arabia'], ['RS', 'Serbia'], ['SG', 'Singapore'], ['SK', 'Slovakia'],
  ['SI', 'Slovenia'], ['ZA', 'South Africa'], ['KR', 'South Korea'], ['ES', 'Spain'],
  ['LK', 'Sri Lanka'], ['SE', 'Sweden'], ['CH', 'Switzerland'], ['TW', 'Taiwan'],
  ['TH', 'Thailand'], ['TN', 'Tunisia'], ['TR', 'Turkey'], ['UA', 'Ukraine'],
  ['AE', 'United Arab Emirates'], ['GB', 'United Kingdom'], ['US', 'United States'],
  ['UY', 'Uruguay'], ['VA', 'Vatican City'], ['VE', 'Venezuela'], ['VN', 'Vietnam'],
] as const;

/**
 * Catalog rows remain organisation-scoped so existing tenant ownership checks
 * and product foreign keys stay intact. Brands select from this curated set;
 * they do not create or delete taxonomy records themselves.
 */
export async function provisionOrganisationCatalog(
  tx: Prisma.TransactionClient,
  organisationId: string,
) {
  await Promise.all([
    tx.category.createMany({
      data: CATEGORY_CATALOG.map((name) => ({ organisationId, name })),
      skipDuplicates: true,
    }),
    tx.country.createMany({
      data: COUNTRY_CATALOG.map(([code, name]) => ({ organisationId, code, name })),
      skipDuplicates: true,
    }),
    tx.materialPreset.createMany({
      data: MATERIAL_CATALOG.map(({ name, group }) => ({ organisationId, name, group })),
      skipDuplicates: true,
    }),
  ]);
}
