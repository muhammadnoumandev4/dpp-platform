// Turns raw audit-log rows into plain-language activity entries.
// Kept free of React so the wording rules stay readable and testable on their own.

export interface AuditEntry {
  id: string;
  action: string;
  entityType: string;
  entityId: string;
  entityLabel: string | null;
  diff: Record<string, unknown> | null;
  createdAt: string;
  actor: { name: string; email: string };
}

export type ActivityCategory = 'products' | 'passports' | 'team' | 'brand';
export type ActivityTone = 'publish' | 'edit' | 'team' | 'brand' | 'destructive';

export interface ActivityChange {
  field: string;
  label: string;
  from: string | null;
  to: string;
}

export interface ActivityItem {
  id: string;
  action: string;
  createdAt: string;
  actor: { name: string; email: string };
  /** How many consecutive identical events were merged into this one. */
  count: number;
  lead: string;
  object: { label: string; href: string | null } | null;
  tail: string;
  category: ActivityCategory;
  categoryLabel: string;
  tone: ActivityTone;
  destructive: boolean;
  changes: ActivityChange[];
  /** Everything the row says, flattened — used by the search box. */
  searchText: string;
}

export const CATEGORY_LABELS: Record<ActivityCategory, string> = {
  products: 'Products',
  passports: 'Passports',
  team: 'Team',
  brand: 'Brand',
};

const DESTRUCTIVE_ACTIONS = new Set([
  'PRODUCT_ARCHIVED',
  'PASSPORT_UNPUBLISHED',
  'IMAGE_REMOVED',
  'DOCUMENT_REMOVED',
  'CERTIFICATION_REMOVED',
  'USER_DEACTIVATED',
  'BRAND_SUSPENDED',
]);

const FIELD_LABELS: Record<string, string> = {
  name: 'Name',
  sku: 'SKU',
  serialNumber: 'Serial number',
  categoryId: 'Category',
  description: 'Description',
  productionDate: 'Production date',
  countryOfOriginId: 'Country of origin',
  materials: 'Materials',
  sustainability: 'Sustainability data',
  logoUrl: 'Logo',
  accentColor: 'Brand colour',
  contactEmail: 'Contact email',
  website: 'Website',
  country: 'Country',
  industry: 'Industry',
};

function categoryOf(entry: AuditEntry): ActivityCategory {
  if (entry.action.startsWith('PASSPORT_')) return 'passports';
  if (entry.action.startsWith('BRAND_') || entry.entityType === 'Organisation') return 'brand';
  if (entry.entityType === 'User' || entry.entityType === 'Invitation') return 'team';
  return 'products';
}

function toneOf(entry: AuditEntry, category: ActivityCategory): ActivityTone {
  if (DESTRUCTIVE_ACTIONS.has(entry.action)) return 'destructive';
  if (entry.action === 'PASSPORT_PUBLISHED') return 'publish';
  if (category === 'team') return 'team';
  if (category === 'brand') return 'brand';
  return 'edit';
}

function hrefOf(entry: AuditEntry, category: ActivityCategory): string | null {
  if (entry.entityType === 'Product') return `/products/${entry.entityId}`;
  if (category === 'team') return '/users';
  if (category === 'brand') return '/settings';
  return null;
}

function diffString(diff: Record<string, unknown> | null, key: string): string | null {
  const value = diff?.[key];
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function plural(count: number, one: string, many: string) {
  return count === 1 ? one : `${count} ${many}`;
}

/** The sentence, minus the actor's name which is always rendered in bold up front. */
function phraseOf(entry: AuditEntry, count: number): { lead: string; tail: string } {
  const certificate = diffString(entry.diff, 'name');
  const document = diffString(entry.diff, 'fileName');

  switch (entry.action) {
    case 'PRODUCT_CREATED':
      return { lead: 'created a new product,', tail: '' };
    case 'PRODUCT_UPDATED':
      return { lead: 'updated', tail: '' };
    case 'PRODUCT_ARCHIVED':
      return { lead: 'archived', tail: '' };
    case 'PASSPORT_PUBLISHED':
      return { lead: 'published the passport for', tail: '' };
    case 'PASSPORT_UNPUBLISHED':
      return { lead: 'took the passport for', tail: 'offline' };
    case 'IMAGE_ADDED':
      return { lead: `added ${plural(count, 'a photo', 'photos')} to`, tail: '' };
    case 'IMAGE_REMOVED':
      return { lead: `removed ${plural(count, 'a photo', 'photos')} from`, tail: '' };
    case 'COVER_IMAGE_CHANGED':
      return { lead: 'changed the cover photo of', tail: '' };
    case 'DOCUMENT_ADDED':
      return { lead: document ? `attached ${document} to` : 'attached a document to', tail: '' };
    case 'DOCUMENT_REMOVED':
      return { lead: document ? `removed ${document} from` : 'removed a document from', tail: '' };
    case 'CERTIFICATION_ADDED':
      return { lead: certificate ? `added the ${certificate} certificate to` : 'added a certificate to', tail: '' };
    case 'CERTIFICATION_REMOVED':
      return {
        lead: certificate ? `removed the ${certificate} certificate from` : 'removed a certificate from',
        tail: '',
      };
    case 'USER_DEACTIVATED':
      return { lead: 'deactivated the account of', tail: '' };
    case 'INVITATION_CREATED':
      return { lead: 'invited', tail: '' };
    case 'INVITATION_ACCEPTED':
      return { lead: 'joined the team', tail: '' };
    case 'ORGANISATION_UPDATED':
      return { lead: 'updated the brand profile of', tail: '' };
    case 'BRAND_REGISTERED':
      return { lead: 'registered the brand', tail: '' };
    case 'BRAND_SUSPENDED':
      return { lead: 'suspended the brand', tail: '' };
    default:
      return { lead: entry.action.toLowerCase().replaceAll('_', ' '), tail: '' };
  }
}

/** Actions whose object is already named inside the sentence, or that have none. */
const ACTIONS_WITHOUT_OBJECT = new Set(['INVITATION_ACCEPTED']);

export function humaniseField(field: string) {
  if (FIELD_LABELS[field]) return FIELD_LABELS[field];
  return field.replace(/([A-Z])/g, ' $1').replace(/^./, (character) => character.toUpperCase());
}

export function formatValue(value: unknown): string {
  if (value === null || value === undefined || value === '') return 'Not set';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (Array.isArray(value)) return value.length ? value.map((item) => formatValue(item)).join(', ') : 'None';
  if (typeof value === 'object') return 'Updated';
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(value)) {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) return parsed.toLocaleDateString();
  }
  return String(value);
}

/**
 * Only `changed` maps ({ field: { from, to } }) become before → after lines.
 * Everything else in a diff is internal bookkeeping (uuids, version numbers,
 * image ids) that a store owner has no use for, so it is deliberately dropped.
 */
export function extractChanges(diff: Record<string, unknown> | null): ActivityChange[] {
  const changed = diff?.changed;
  if (!changed || typeof changed !== 'object' || Array.isArray(changed)) return [];

  return Object.entries(changed as Record<string, unknown>)
    .filter(([, value]) => value !== null && typeof value === 'object' && 'to' in (value as object))
    .map(([field, value]) => {
      const { from, to } = value as { from?: unknown; to?: unknown };
      return { field, from, to };
    })
    .filter(({ from, to }) => JSON.stringify(from ?? null) !== JSON.stringify(to ?? null))
    .map(({ field, from, to }) => {
      // Identifier and nested fields would only surface uuids or JSON blobs.
      const opaque = field.endsWith('Id') || (to !== null && typeof to === 'object');
      return {
        field,
        label: humaniseField(field),
        from: opaque ? null : formatValue(from),
        to: opaque ? 'Updated' : formatValue(to),
      };
    });
}

const MERGE_WINDOW_MS = 10 * 60 * 1000;
const MERGEABLE_ACTIONS = new Set(['IMAGE_ADDED', 'IMAGE_REMOVED']);

function mergeable(a: AuditEntry, b: AuditEntry) {
  return (
    MERGEABLE_ACTIONS.has(a.action) &&
    a.action === b.action &&
    a.entityId === b.entityId &&
    a.actor.email === b.actor.email &&
    Math.abs(new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()) <= MERGE_WINDOW_MS
  );
}

export function toActivityItems(entries: AuditEntry[]): ActivityItem[] {
  // Bulk uploads write one row per file; consecutive twins read better as "added 3 photos".
  const groups: AuditEntry[][] = [];
  for (const entry of entries) {
    const previous = groups.at(-1);
    if (previous && mergeable(previous[0], entry)) previous.push(entry);
    else groups.push([entry]);
  }

  return groups.map((group) => {
    const entry = group[0];
    const category = categoryOf(entry);
    const { lead, tail } = phraseOf(entry, group.length);
    const objectLabel = ACTIONS_WITHOUT_OBJECT.has(entry.action) ? null : entry.entityLabel;
    const object = objectLabel ? { label: objectLabel, href: hrefOf(entry, category) } : null;
    const changes = group.length === 1 ? extractChanges(entry.diff) : [];

    return {
      id: entry.id,
      action: entry.action,
      createdAt: entry.createdAt,
      actor: entry.actor,
      count: group.length,
      lead,
      object,
      tail,
      category,
      categoryLabel: CATEGORY_LABELS[category],
      tone: toneOf(entry, category),
      destructive: DESTRUCTIVE_ACTIONS.has(entry.action),
      changes,
      searchText: [
        entry.actor.name,
        entry.actor.email,
        lead,
        object?.label ?? '',
        tail,
        CATEGORY_LABELS[category],
        ...changes.flatMap((change) => [change.label, change.from ?? '', change.to]),
      ]
        .join(' ')
        .toLowerCase(),
    };
  });
}

export function dayKey(iso: string) {
  const date = new Date(iso);
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

export function dayLabel(iso: string) {
  const date = new Date(iso);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);

  if (dayKey(iso) === dayKey(today.toISOString())) return 'Today';
  if (dayKey(iso) === dayKey(yesterday.toISOString())) return 'Yesterday';
  return date.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });
}

export function timeLabel(iso: string) {
  return new Date(iso).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

export function groupByDay(items: ActivityItem[]) {
  const days: { key: string; label: string; items: ActivityItem[] }[] = [];
  for (const item of items) {
    const key = dayKey(item.createdAt);
    const current = days.at(-1);
    if (current?.key === key) current.items.push(item);
    else days.push({ key, label: dayLabel(item.createdAt), items: [item] });
  }
  return days;
}
