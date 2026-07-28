'use client';

import { useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { Alert, Avatar, Box, Button, Chip, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle, IconButton, Paper, Tab, Tabs, Typography } from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import DownloadIcon from '@mui/icons-material/Download';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import CloseIcon from '@mui/icons-material/Close';
import { API_URL, api, ApiError } from '@/lib/api/client';
import { StatusPill } from '@/components/domain/StatusPill';
import { useProductEditor } from './useProductEditor';
import { GeneralTab } from './tabs/GeneralTab';
import { MaterialsTab } from './tabs/MaterialsTab';
import { SustainabilityTab } from './tabs/SustainabilityTab';
import { CertificationsTab } from './tabs/CertificationsTab';
import { DocumentsTab } from './tabs/DocumentsTab';
import { ImagesTab } from './tabs/ImagesTab';
import { PreviewTab } from './tabs/PreviewTab';
import { InventoryTab } from './tabs/InventoryTab';
import { RequirePermission } from '@/components/RequirePermission';
import { useAuth } from '@/lib/auth-context';
import { useConfirm } from '@/components/providers/ConfirmProvider';
import { useToast } from '@/components/providers/ToastProvider';

const TABS = ['General', 'Materials', 'Sustainability', 'Certifications', 'Documents', 'Images', 'Preview', 'Inventory'] as const;

export default function ProductEditorPage() {
  const params = useParams();
  const { user } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const id = params.id as string;
  const { product, categories, countries, materialPresets, publishStatus, loadError, reload } = useProductEditor(id);
  const [tab, setTab] = useState(searchParams.get('tab') === 'preview' ? 6 : 0);
  const [publishing, setPublishing] = useState(false);
  const [publishError, setPublishError] = useState<string | null>(null);
  const [successDialogOpen, setSuccessDialogOpen] = useState(false);
  const confirm = useConfirm();
  const toast = useToast();

  if (loadError) {
    return (
      <Alert severity="error">
        We couldn&apos;t load this product. <Button size="small" onClick={reload}>Retry</Button>
      </Alert>
    );
  }

  if (!product || !publishStatus) {
    return <CircularProgress size={24} />;
  }

  async function handlePublish() {
    const confirmed = await confirm({
      title: 'Publish Product Passport?',
      message: (
        <Box sx={{ mt: 1 }}>
          {/* Prominent Product Preview Card */}
          <Paper
            variant="outlined"
            sx={{
              p: 2,
              mb: 2.5,
              bgcolor: 'grey.50',
              borderRadius: 2,
              display: 'flex',
              alignItems: 'center',
              gap: 2,
              border: '1px solid',
              borderColor: 'divider',
            }}
          >
            <Avatar
              variant="rounded"
              src={cover ? `${API_URL}/uploads/${cover.fileKey}` : undefined}
              sx={{ width: 64, height: 64, bgcolor: '#fff', border: '1px solid', borderColor: 'divider', boxShadow: 1 }}
            />
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography variant="subtitle1" fontWeight={700} noWrap sx={{ fontSize: '1.05rem' }}>
                {product.name}
              </Typography>
              <Typography variant="caption" color="text.secondary" sx={{ fontFamily: 'monospace', display: 'block', mt: 0.25 }}>
                SKU: {product.sku}
              </Typography>
              {product.category && (
                <Chip label={product.category.name} size="small" variant="outlined" sx={{ mt: 0.75, height: 22, fontSize: 11, fontWeight: 500 }} />
              )}
            </Box>
            <Chip label="Ready to Publish" color="success" size="small" sx={{ fontWeight: 600, px: 0.5 }} />
          </Paper>

          <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.6 }}>
            Publishing will make the Digital Product Passport for <strong>{product.name}</strong> publicly accessible to consumers via QR code scan and generate a permanent public URL.
          </Typography>
        </Box>
      ),
      severity: 'publish',
      confirmText: 'Publish Product',
    });

    if (!confirmed) return;

    setPublishing(true);
    setPublishError(null);
    try {
      await api.post(`/products/${id}/publish`);
      await reload(); // Reload to get the new publishStatus with UUID and QR
      setSuccessDialogOpen(true);
    } catch (err) {
      const blockers = err instanceof ApiError ? err.body?.blockers : undefined;
      setPublishError(err instanceof ApiError ? blockers?.map((b: any) => b.message).join(' · ') ?? err.message : 'Could not publish.');
      toast.error('Failed to publish Product Passport.');
    } finally {
      setPublishing(false);
    }
  }

  async function handleCopyLink() {
    if (publishStatus?.uuid) {
      const url = `${window.location.origin}/passport/${publishStatus.uuid}`;
      await navigator.clipboard.writeText(url);
      toast.success('Link copied to clipboard');
    }
  }

  async function downloadQr() {
    if (!publishStatus?.qrUrl) return;
    try {
      const response = await fetch(publishStatus.qrUrl);
      if (!response.ok) throw new Error('QR download failed');
      const blobUrl = URL.createObjectURL(await response.blob());
      const link = document.createElement('a');
      const safeName = product.name.trim().replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toLowerCase();
      link.href = blobUrl;
      link.download = `${safeName || 'product'}-passport-qr.png`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(blobUrl);
    } catch (err) {
      toast.error('Failed to download QR code');
    }
  }

  const cover = product.images.find((i) => i.isCover);
  const publishLabel = publishStatus.isPublished ? (publishStatus.hasUnpublishedChanges ? 'Publish update' : 'Published') : 'Publish';

  return (
    <Box>
      <Button size="small" onClick={() => router.push('/products')} sx={{ mb: 1.5 }}>← Products</Button>

      {/* Prominent Header Banner */}
      <Paper
        variant="outlined"
        sx={{
          p: 2.5,
          mb: 3,
          bgcolor: '#ffffff',
          borderRadius: 2,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 2,
          flexWrap: 'wrap',
          boxShadow: '0 2px 10px rgba(0,0,0,0.03)',
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2.5, minWidth: 0, flex: 1 }}>
          <Avatar
            variant="rounded"
            src={cover ? `${API_URL}/uploads/${cover.fileKey}` : undefined}
            sx={{ width: 68, height: 68, bgcolor: 'grey.100', border: '1px solid', borderColor: 'divider', boxShadow: 1 }}
          />
          <Box sx={{ minWidth: 0 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, flexWrap: 'wrap' }}>
              <Typography variant="h1" sx={{ wordBreak: 'break-word', fontWeight: 700, fontSize: { xs: '1.25rem', md: '1.5rem' } }}>
                {product.name}
              </Typography>
              <StatusPill status={product.status} />
              {publishStatus.hasUnpublishedChanges && (
                <Box
                  component="span"
                  sx={{ fontSize: 12, fontWeight: 600, px: 1, py: 0.25, borderRadius: 1, bgcolor: 'warning.50', color: 'warning.main', border: '1px solid', borderColor: 'warning.main' }}
                >
                  Unpublished changes
                </Box>
              )}
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mt: 0.5 }}>
              <Typography variant="body2" color="text.secondary" sx={{ fontFamily: 'monospace', fontWeight: 600 }}>
                SKU: {product.sku}
              </Typography>
              {product.category && (
                <Chip label={product.category.name} size="small" variant="outlined" sx={{ height: 22, fontSize: 11, fontWeight: 500 }} />
              )}
            </Box>
          </Box>
        </Box>

        {/* Header Actions (Pinned to Far Right Corner) */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap', ml: 'auto' }}>
          {publishStatus.uuid && (
            <Button
              component="a"
              href={`/passport/${publishStatus.uuid}`}
              target="_blank"
              rel="noreferrer"
              variant="outlined"
              color="primary"
              endIcon={<OpenInNewIcon fontSize="small" />}
              sx={{
                fontWeight: 600,
                px: 2,
                py: 0.8,
                bgcolor: 'primary.50',
                borderColor: 'primary.main',
                boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                '&:hover': { bgcolor: 'primary.100', borderColor: 'primary.dark' },
              }}
            >
              View Public Passport
            </Button>
          )}

          <RequirePermission
            permission="products.publish"
            fallback={
              <Typography variant="caption" color="text.secondary">Owner or Manager approval is required to publish.</Typography>
            }
          >
            {(!publishStatus.isPublished || publishStatus.hasUnpublishedChanges) && (
              <Button
                variant="contained"
                onClick={handlePublish}
                disabled={publishing || publishStatus.blockers.length > 0}
                sx={{ fontWeight: 600, px: 2.5, py: 0.8 }}
              >
                {publishing ? 'Publishing…' : publishLabel}
              </Button>
            )}
          </RequirePermission>
        </Box>
      </Paper>

      {publishError && <Alert severity="error" sx={{ mb: 2 }}>{publishError}</Alert>}
      {publishStatus.hasUnpublishedChanges && !publishError && (
        <Alert severity="info" sx={{ mb: 2 }}>
          Consumers currently see version {publishStatus.currentVersion}. These edits are saved as a draft and become
          public only when you publish an update.
        </Alert>
      )}
      {!publishStatus.isPublished && publishStatus.blockers.length > 0 && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          <strong>{publishStatus.blockers.length} item{publishStatus.blockers.length > 1 ? 's' : ''} before publishing:</strong>
          <ul style={{ margin: '4px 0 0', paddingLeft: 18 }}>
            {publishStatus.blockers.map((b) => <li key={b.code}>{b.message}</li>)}
          </ul>
        </Alert>
      )}

      <Tabs 
        value={tab} 
        onChange={(_, v) => setTab(v)} 
        variant="scrollable"
        scrollButtons="auto"
        allowScrollButtonsMobile
        sx={{ mb: 3, borderBottom: '1px solid', borderColor: 'divider' }}
      >
        {TABS.map((label) => <Tab key={label} label={label} />)}
      </Tabs>

      <Box>
        {tab === 0 && <GeneralTab product={product} categories={categories} countries={countries} onSaved={reload} />}
        {tab === 1 && <MaterialsTab product={product} countries={countries} materialPresets={materialPresets} onSaved={reload} />}
        {tab === 2 && <SustainabilityTab product={product} onSaved={reload} />}
        {tab === 3 && <CertificationsTab product={product} onSaved={reload} />}
        {tab === 4 && <DocumentsTab product={product} onSaved={reload} />}
        {tab === 5 && <ImagesTab product={product} onSaved={reload} />}
        {tab === 6 && <PreviewTab product={product} publishStatus={publishStatus} />}
        {tab === 7 && <InventoryTab product={product} isPublished={publishStatus.isPublished} />}
      </Box>

      <Box
        sx={{
          display: 'flex',
          justifyContent: tab === 0 ? 'flex-end' : 'space-between',
          alignItems: 'center',
          gap: 2,
          mt: 3,
          pt: 2,
          borderTop: '1px solid',
          borderColor: 'divider',
        }}
      >
        {tab > 0 && (
          <Button variant="outlined" onClick={() => setTab((current) => current - 1)}>
            ← Back: {TABS[tab - 1]}
          </Button>
        )}

        {tab < TABS.length - 1 ? (
          <Button variant="contained" onClick={() => setTab((current) => current + 1)}>
            Next: {TABS[tab + 1]} →
          </Button>
        ) : (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            {publishStatus.uuid && (
              <Button
                component="a"
                href={`/passport/${publishStatus.uuid}`}
                target="_blank"
                rel="noreferrer"
                variant="outlined"
                color="primary"
                endIcon={<OpenInNewIcon fontSize="small" />}
                sx={{ fontWeight: 600 }}
              >
                View Public Passport
              </Button>
            )}
            <RequirePermission
              permission="products.publish"
              fallback={<Button variant="outlined" disabled>Owner or Manager must publish</Button>}
            >
              {(!publishStatus.isPublished || publishStatus.hasUnpublishedChanges) && (
                <Button
                  variant="contained"
                  onClick={handlePublish}
                  disabled={publishing || publishStatus.blockers.length > 0}
                  sx={{ fontWeight: 600 }}
                >
                  {publishing ? 'Publishing…' : publishLabel}
                </Button>
              )}
            </RequirePermission>
          </Box>
        )}
      </Box>

      <Dialog open={successDialogOpen} onClose={() => setSuccessDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ pr: 6, display: 'flex', alignItems: 'center', gap: 1 }}>
          <CheckCircleIcon color="success" /> Passport published
          <IconButton
            onClick={() => setSuccessDialogOpen(false)}
            aria-label="Close dialog"
            sx={{ position: 'absolute', right: 12, top: 12 }}
          >
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent sx={{ textAlign: 'center', py: 3 }}>
          <Typography variant="body1" sx={{ mb: 3 }}>
            Your Product Passport for <strong>{product.name}</strong> is now live.
          </Typography>
          
          {publishStatus.qrUrl && (
            <Box
              component="img"
              src={publishStatus.qrUrl}
              alt="QR code"
              sx={{ width: '100%', maxWidth: 240, aspectRatio: '1', objectFit: 'contain', mx: 'auto', display: 'block', mb: 2 }}
            />
          )}
          
          <Box sx={{ display: 'flex', gap: 1, justifyContent: 'center', flexWrap: 'wrap' }}>
            {publishStatus.uuid && (
              <>
                <Button variant="outlined" onClick={handleCopyLink} startIcon={<ContentCopyIcon />}>
                  Copy public URL
                </Button>
                <Button href={`/passport/${publishStatus.uuid}`} target="_blank" variant="outlined" endIcon={<OpenInNewIcon />}>
                  View passport
                </Button>
              </>
            )}
            {publishStatus.qrUrl && (
              <Button variant="contained" onClick={downloadQr} startIcon={<DownloadIcon />}>
                Download QR
              </Button>
            )}
          </Box>
        </DialogContent>
      </Dialog>
    </Box>
  );
}
