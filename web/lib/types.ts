// API response shapes (what the server returns — includes persistence fields
// like id/productId/sortOrder) are kept separate from mutation-input shapes
// (what the server's DTOs actually accept). Spreading a response object into
// a PATCH body was the bug: class-validator's forbidNonWhitelisted rejects
// the extra fields, so materials/sustainability updates silently failed.

export interface MaterialResponse {
  id: string;
  name: string;
  percentage: number;
  countryOfOriginId: string | null;
  countryOfOrigin?: { id: string; name: string } | null;
  recyclable: boolean;
  sortOrder: number;
}

export interface MaterialInput {
  name: string;
  percentage: number;
  countryOfOriginId?: string;
  recyclable?: boolean;
}

export function toMaterialInput(material: MaterialResponse | MaterialInput): MaterialInput {
  return {
    name: material.name,
    percentage: material.percentage,
    countryOfOriginId: material.countryOfOriginId ?? undefined,
    recyclable: material.recyclable ?? false,
  };
}

export interface SustainabilityResponse {
  id?: string;
  productId?: string;
  carbonFootprintKg: number | null;
  waterConsumptionL: number | null;
  recycledPercent: number | null;
  repairabilityScore: number | null;
  recyclable?: boolean;
}

export interface SustainabilityInput {
  carbonFootprintKg?: number;
  waterConsumptionL?: number;
  recycledPercent?: number;
  repairabilityScore?: number;
  recyclable?: boolean;
}

export function toSustainabilityInput(
  current: SustainabilityResponse | null,
  patch: Partial<SustainabilityInput>,
): SustainabilityInput {
  return {
    carbonFootprintKg: current?.carbonFootprintKg ?? undefined,
    waterConsumptionL: current?.waterConsumptionL ?? undefined,
    recycledPercent: current?.recycledPercent ?? undefined,
    repairabilityScore: current?.repairabilityScore ?? undefined,
    recyclable: current?.recyclable ?? undefined,
    ...patch,
  };
}

export interface CertificationResponse {
  id: string;
  name: string;
  issuingAuthority: string | null;
  issueDate: string | null;
  expiryDate: string | null;
  fileKey: string | null;
  fileName: string | null;
  sortOrder: number;
}

export interface CertificationInput {
  name: string;
  issuingAuthority?: string;
  issueDate?: string;
  expiryDate?: string;
  fileKey?: string;
  fileName?: string;
}

export type DocumentType = 'MANUAL' | 'WARRANTY' | 'DATASHEET';

export interface DocumentResponse {
  id: string;
  type: DocumentType;
  fileKey: string;
  fileName: string;
  sizeBytes: number;
  sortOrder: number;
}

export interface DocumentInput {
  type: DocumentType;
  fileKey: string;
  fileName: string;
  sizeBytes: number;
}

export interface ProductImageResponse {
  id: string;
  fileKey: string;
  isCover: boolean;
  altText: string | null;
  sortOrder: number;
}

export interface CategoryResponse {
  id: string;
  name: string;
}

export interface CountryResponse {
  id: string;
  name: string;
  code: string;
}

export interface MaterialPresetResponse {
  id: string;
  name: string;
  group: string;
}

export interface PublishBlocker {
  code: string;
  path: string;
  message: string;
}

export interface PublishStatus {
  blockers: PublishBlocker[];
  isPublished: boolean;
  hasUnpublishedChanges: boolean;
  currentVersion: number | null;
  publishedAt: string | null;
  uuid: string | null;
  qrUrl: string | null;
}

/**
 * The shape rendered by <PassportView>. In the back office it comes from
 * GET /products/:id (a live, editable Product). On the public page it comes
 * from the immutable PassportVersion.snapshot served by GET /passport/:uuid.
 * Both endpoints return this same field set by construction — see
 * PRODUCT_INCLUDE / SNAPSHOT_INCLUDE in the API — so one component can
 * render either without a translation layer.
 */
export interface PassportProduct {
  id: string;
  name: string;
  sku: string;
  serialNumber: string | null;
  description: string | null;
  productionDate: string | null;
  status?: string;
  category: { id: string; name: string } | null;
  countryOfOrigin: { id: string; name: string } | null;
  materials: MaterialResponse[];
  sustainability: SustainabilityResponse | null;
  certifications: CertificationResponse[];
  documents: DocumentResponse[];
  images: ProductImageResponse[];
  organisation?: { name: string; logoUrl?: string | null; accentColor?: string | null };
}

export interface FullProduct extends PassportProduct {
  categoryId: string | null;
  countryOfOriginId: string | null;
  status: string;
  createdAt: string;
  updatedAt: string;
  passport: {
    id: string;
    uuid: string;
    version: number;
    createdAt: string;
    publishedAt: string | null;
    unpublishedAt: string | null;
    qrUrl: string | null;
  } | null;
}
