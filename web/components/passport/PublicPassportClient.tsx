'use client';

import { useEffect, useRef, useState } from 'react';
import { Box, CircularProgress } from '@mui/material';
import { PublicPassportShell, PassportUnavailable } from '@/components/passport/PublicPassportShell';
import { getPublicApiUrl, type PublicPassportResponse } from '@/lib/passport/fetch-public';

/**
 * Client-side fallback loader (e.g. preview embeds). Public QR routes use SSR.
 */
function PublicPassportLoader({
  endpointPath,
  scanPath,
  fetchKey,
  fromQr,
}: {
  endpointPath: string;
  scanPath: string;
  fetchKey: string;
  fromQr: boolean;
}) {
  const [state, setState] = useState<
    | { status: 'loading' }
    | { status: 'not-found' }
    | { status: 'error' }
    | { status: 'ready'; data: PublicPassportResponse }
  >({ status: 'loading' });
  const fetchedKey = useRef<string | null>(null);

  useEffect(() => {
    if (fetchedKey.current === fetchKey) return;
    fetchedKey.current = fetchKey;
    setState({ status: 'loading' });

    fetch(`${getPublicApiUrl()}${endpointPath}`, {
      headers: { 'x-skip-scan': '1' },
    })
      .then((res) => {
        if (res.status === 404 || res.status === 410) {
          setState({ status: 'not-found' });
          return null;
        }
        if (!res.ok) {
          setState({ status: 'error' });
          return null;
        }
        return res.json();
      })
      .then((data) => {
        if (data) setState({ status: 'ready', data });
      })
      .catch(() => setState({ status: 'error' }));
  }, [endpointPath, fetchKey]);

  if (state.status === 'loading') {
    return (
      <Box sx={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <CircularProgress aria-label="Loading passport" />
      </Box>
    );
  }

  if (state.status === 'not-found') {
    return (
      <PassportUnavailable
        title="This passport isn't available"
        body="The code you scanned doesn't resolve to a live product passport. It may never have existed, or the brand may have taken it down."
      />
    );
  }

  if (state.status === 'error') {
    return (
      <PassportUnavailable
        title="Something went wrong"
        body="We couldn't load this passport right now. Please try again in a moment."
      />
    );
  }

  return <PublicPassportShell data={state.data} fromQr={fromQr} scanPath={scanPath} />;
}

export function PublicPassportByUuid({ uuid, fromQr }: { uuid: string; fromQr: boolean }) {
  return (
    <PublicPassportLoader
      endpointPath={`/passport/${uuid}`}
      scanPath={`/passport/${uuid}/scan`}
      fetchKey={uuid}
      fromQr={fromQr}
    />
  );
}

export function PublicPassportByItem({ itemUuid, fromQr }: { itemUuid: string; fromQr: boolean }) {
  return (
    <PublicPassportLoader
      endpointPath={`/passport/i/${itemUuid}`}
      scanPath={`/passport/i/${itemUuid}/scan`}
      fetchKey={itemUuid}
      fromQr={fromQr}
    />
  );
}
