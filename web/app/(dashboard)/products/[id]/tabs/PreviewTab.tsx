'use client';

import { useEffect, useState } from 'react';
import {
  Alert,
  Box,
  CircularProgress,
  Paper,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material';
import PhoneIphoneIcon from '@mui/icons-material/PhoneIphoneOutlined';
import LaptopMacIcon from '@mui/icons-material/LaptopMacOutlined';
import { API_URL, api } from '@/lib/api/client';
import { PassportView, type PassportInfo } from '@/components/passport/PassportView';
import type { FullProduct, PassportProduct, PublishStatus } from '@/lib/types';

interface VersionPayload {
  uuid: string;
  version: number;
  publishedAt: string;
  snapshot: PassportProduct;
}

export function PreviewTab({
  product,
  publishStatus,
}: {
  product: FullProduct;
  publishStatus: PublishStatus | null;
}) {
  const [device, setDevice] = useState<'mobile' | 'desktop'>('mobile');
  const hasPublished = Boolean(publishStatus?.isPublished && publishStatus.currentVersion);
  const [mode, setMode] = useState<'published' | 'draft'>(hasPublished ? 'published' : 'draft');
  const [published, setPublished] = useState<VersionPayload | null>(null);
  const [loadingPublished, setLoadingPublished] = useState(false);
  const [publishedError, setPublishedError] = useState(false);

  useEffect(() => {
    setMode(hasPublished ? 'published' : 'draft');
  }, [hasPublished, product.id]);

  useEffect(() => {
    if (!hasPublished || !publishStatus?.currentVersion) {
      setPublished(null);
      return;
    }

    let cancelled = false;
    setLoadingPublished(true);
    setPublishedError(false);
    api
      .get<VersionPayload>(`/products/${product.id}/passport-versions/${publishStatus.currentVersion}`)
      .then((payload) => {
        if (!cancelled) setPublished(payload);
      })
      .catch(() => {
        if (!cancelled) setPublishedError(true);
      })
      .finally(() => {
        if (!cancelled) setLoadingPublished(false);
      });

    return () => {
      cancelled = true;
    };
  }, [hasPublished, product.id, publishStatus?.currentVersion]);

  const draftPassportInfo: PassportInfo | null = null;
  const publishedPassportInfo: PassportInfo | null =
    published && publishStatus
      ? {
          uuid: published.uuid,
          version: published.version,
          createdAt: product.passport?.createdAt ?? published.publishedAt,
          publishedAt: published.publishedAt,
          status: 'PUBLISHED',
          verificationStatus: 'VERIFIED',
        }
      : null;

  const showingPublished = mode === 'published' && hasPublished;
  const viewProduct: PassportProduct = showingPublished && published ? published.snapshot : product;
  const viewInfo = showingPublished ? publishedPassportInfo : draftPassportInfo;

  return (
    <Paper variant="outlined" sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2, gap: 2, flexWrap: 'wrap' }}>
        <Typography variant="h3">Preview</Typography>
        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
          {hasPublished && (
            <ToggleButtonGroup
              size="small"
              value={mode}
              exclusive
              onChange={(_, value: 'published' | 'draft' | null) => value && setMode(value)}
              aria-label="Preview source"
            >
              <ToggleButton value="published">Published (live)</ToggleButton>
              <ToggleButton value="draft">Draft</ToggleButton>
            </ToggleButtonGroup>
          )}
          <ToggleButtonGroup size="small" value={device} exclusive onChange={(_, v) => v && setDevice(v)}>
            <ToggleButton value="mobile" aria-label="Mobile preview">
              <PhoneIphoneIcon fontSize="small" />
            </ToggleButton>
            <ToggleButton value="desktop" aria-label="Desktop preview">
              <LaptopMacIcon fontSize="small" />
            </ToggleButton>
          </ToggleButtonGroup>
        </Box>
      </Box>

      {showingPublished ? (
        <Typography variant="caption" color="text.secondary" sx={{ mb: 2, display: 'block' }}>
          Exact consumer view: immutable snapshot v{publishStatus?.currentVersion} rendered with the same{' '}
          <code>PassportView</code> as <code>/passport/{'{uuid}'}</code>.
          {publishStatus?.hasUnpublishedChanges
            ? ' You have unpublished draft edits — switch to Draft to review them, then republish.'
            : ''}
        </Typography>
      ) : (
        <Typography variant="caption" color="text.secondary" sx={{ mb: 2, display: 'block' }}>
          Draft preview (not public). No Verified badge until publish. Save tab edits before relying on this view.
        </Typography>
      )}

      {publishStatus?.hasUnpublishedChanges && showingPublished && (
        <Alert severity="info" sx={{ mb: 2 }}>
          Draft differs from this live snapshot. Republish to push changes to consumers.
        </Alert>
      )}

      {showingPublished && loadingPublished && (
        <Box sx={{ py: 6, display: 'grid', placeItems: 'center' }}>
          <CircularProgress aria-label="Loading published snapshot" />
        </Box>
      )}

      {showingPublished && publishedError && (
        <Alert severity="error">Could not load the published snapshot.</Alert>
      )}

      {(!showingPublished || (published && !loadingPublished)) && (
        <Box
          sx={{
            mx: 'auto',
            maxWidth: device === 'mobile' ? 400 : '100%',
            border: '1px solid',
            borderColor: 'divider',
            borderRadius: 2,
            overflow: 'hidden',
            bgcolor: 'background.default',
          }}
        >
          <PassportView product={viewProduct} passportInfo={viewInfo} apiBaseUrl={API_URL} />
        </Box>
      )}
    </Paper>
  );
}
