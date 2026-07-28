import type { PassportProduct } from '@/lib/types';

export interface PublicPassportResponse {
  id: string;
  uuid: string;
  version: number;
  createdAt: string;
  publishedAt: string;
  status: 'PUBLISHED';
  verificationStatus: 'VERIFIED';
  product: PassportProduct;
}

/** Browser-facing API origin (QR links, PDF downloads, scan beacon). */
export function getPublicApiUrl(): string {
  return process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';
}

/**
 * Server-side fetch origin. In Docker the web container reaches the API via
 * the compose service name; browsers still use NEXT_PUBLIC_API_URL (localhost).
 */
export function getServerApiUrl(): string {
  return process.env.INTERNAL_API_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';
}

export async function fetchPublicPassport(
  path: string,
): Promise<{ ok: true; data: PublicPassportResponse } | { ok: false; status: number }> {
  try {
    const res = await fetch(`${getServerApiUrl()}${path}`, {
      headers: { 'x-skip-scan': '1' },
      next: { revalidate: 60 },
    });
    if (!res.ok) return { ok: false, status: res.status };
    const data = (await res.json()) as PublicPassportResponse;
    return { ok: true, data };
  } catch {
    return { ok: false, status: 503 };
  }
}
