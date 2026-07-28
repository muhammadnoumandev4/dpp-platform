'use client';

import { useEffect, useRef } from 'react';
import { getPublicApiUrl } from '@/lib/passport/fetch-public';

/**
 * Records a scan from the browser after SSR so analytics capture client IP/UA.
 * Dedupes Strict Mode double-mount with a session-scoped key.
 */
export function ScanBeacon({
  scanPath,
  fromQr,
}: {
  scanPath: string;
  fromQr: boolean;
}) {
  const sent = useRef(false);

  useEffect(() => {
    if (sent.current) return;
    sent.current = true;
    const scanId = crypto.randomUUID();
    const key = `scan:${scanPath}:${fromQr ? 'qr' : 'direct'}`;
    try {
      if (sessionStorage.getItem(key)) return;
      sessionStorage.setItem(key, '1');
    } catch {
      // Private mode / blocked storage — still attempt once per mount.
    }
    void fetch(`${getPublicApiUrl()}${scanPath}`, {
      method: 'POST',
      headers: {
        'x-scan-id': scanId,
        ...(fromQr ? { 'x-scan-source': 'qr' } : {}),
      },
      keepalive: true,
    }).catch(() => {
      // Analytics must never block the reader experience.
    });
  }, [scanPath, fromQr]);

  return null;
}
