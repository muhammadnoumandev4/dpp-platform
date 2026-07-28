'use client';

import { useEffect, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Divider,
  MenuItem,
  Paper,
  Tab,
  Tabs,
  TextField,
  Typography,
} from '@mui/material';
import { api, ApiError } from '@/lib/api/client';
import { useAuth } from '@/lib/auth-context';
import { useConfirm } from '@/components/providers/ConfirmProvider';
import { useToast } from '@/components/providers/ToastProvider';
import { useUnsavedChanges } from '@/hooks/useUnsavedChanges';
import { usePermissions } from '@/lib/hooks/usePermissions';

interface Organisation {
  id: string;
  name: string;
  publicSlug: string;
  logoUrl: string | null;
  accentColor: string | null;
  description: string | null;
  contactEmail: string | null;
  website: string | null;
  country: string | null;
  industry: string | null;
}

interface AuditEntry {
  id: string;
  action: string;
  entityType: string;
  entityId: string;
  diff: Record<string, unknown> | null;
  createdAt: string;
  actor: { name: string; email: string };
}

function AuditLogTab() {
  const [rows, setRows] = useState<AuditEntry[] | null>(null);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function load(cursor?: string) {
    setError(null);
    try {
      const result = await api.get<{ rows: AuditEntry[]; nextCursor: string | null }>(
        `/audit-log?limit=25${cursor ? `&cursor=${cursor}` : ''}`,
      );
      setRows((current) => cursor && current ? [...current, ...result.rows] : result.rows);
      setNextCursor(result.nextCursor);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not load the audit log.');
    }
  }

  useEffect(() => { load(); }, []);

  if (error && !rows) return <Alert severity="error">{error}</Alert>;
  if (!rows) return <CircularProgress size={24} />;

  return (
    <Paper variant="outlined" sx={{ p: 3 }}>
      <Typography variant="h3" sx={{ mb: 2 }}>Audit log</Typography>
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      {rows.length === 0 ? (
        <Typography variant="body2" color="text.secondary">No recorded changes yet.</Typography>
      ) : rows.map((entry) => (
        <Box key={entry.id} sx={{ py: 1.5, borderBottom: '1px solid', borderColor: 'divider' }}>
          <Typography variant="body2">
            <strong>{entry.actor.name}</strong> {entry.action.toLowerCase().replaceAll('_', ' ')}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {entry.entityType} · {new Date(entry.createdAt).toLocaleString()}
          </Typography>
          {entry.diff && typeof entry.diff === 'object' && (
            <Box component="details" sx={{ mt: 0.5 }}>
              <Typography component="summary" variant="caption" sx={{ cursor: 'pointer', color: 'primary.main', '&:hover': { textDecoration: 'underline' } }}>
                View change details
              </Typography>
              <Box sx={{ mt: 1, p: 1.5, bgcolor: 'grey.50', borderRadius: 1, border: '1px solid', borderColor: 'grey.200' }}>
                {Object.entries(entry.diff).map(([key, value]) => {
                  let displayValue = String(value);
                  if (value === null || value === undefined) displayValue = 'None';
                  else if (typeof value === 'boolean') displayValue = value ? 'Yes' : 'No';
                  else if (Array.isArray(value)) displayValue = value.join(', ');
                  else if (typeof value === 'object') displayValue = 'Updated';

                  return (
                    <Box key={key} sx={{ display: 'flex', gap: 2, mb: 0.5, fontSize: 12, alignItems: 'center' }}>
                      <Typography variant="caption" sx={{ fontWeight: 600, color: 'text.secondary', minWidth: 120 }}>
                        {key.replace(/([A-Z])/g, ' $1').replace(/^./, (str) => str.toUpperCase())}
                      </Typography>
                      <Typography variant="caption" sx={{ bgcolor: 'white', px: 1, py: 0.5, borderRadius: 1, border: '1px solid', borderColor: 'grey.200' }}>
                        {displayValue}
                      </Typography>
                    </Box>
                  );
                })}
              </Box>
            </Box>
          )}
        </Box>
      ))}
      {nextCursor && <Button sx={{ mt: 2 }} onClick={() => load(nextCursor)}>Load more</Button>}
    </Paper>
  );
}

const INDUSTRIES = [
  'Apparel & Fashion',
  'Automotive',
  'Beauty & Cosmetics',
  'Consumer Electronics',
  'Food & Beverage',
  'Furniture & Home',
  'Jewellery & Luxury',
  'Sporting Goods',
  'Other',
];

const EDITABLE_ORGANISATION_FIELDS = [
  'name',
  'accentColor',
  'description',
  'contactEmail',
  'website',
  'country',
  'industry',
] as const;

function storageKeyFromUrl(url: string | null): string | null {
  if (!url) return null;
  const marker = '/uploads/';
  const markerIndex = url.indexOf(marker);
  return markerIndex === -1 ? null : decodeURIComponent(url.slice(markerIndex + marker.length));
}

function announceOrganisationUpdate(organisation: Organisation) {
  window.dispatchEvent(new CustomEvent('organisation-updated', {
    detail: {
      name: organisation.name,
      logoUrl: organisation.logoUrl,
      accentColor: organisation.accentColor,
    },
  }));
}

function OrganisationTab({ canManageBrand }: { canManageBrand: boolean }) {
  const [org, setOrg] = useState<Organisation | null>(null);
  const [original, setOriginal] = useState<Organisation | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);

  const confirm = useConfirm();
  const toast = useToast();

  useEffect(() => {
    api.get<Organisation>('/organisation')
      .then((organisation) => {
        setOrg(organisation);
        setOriginal(organisation);
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Could not load organisation.'));
  }, []);

  const dirty = Boolean(
    original && org && EDITABLE_ORGANISATION_FIELDS.some((field) => (org[field] ?? '') !== (original[field] ?? '')),
  );
  
  useUnsavedChanges(dirty);

  async function saveProfile() {
    if (!org) return;
    setError(null);
    setSaved(false);
    setSaving(true);
    try {
      const updated = await api.patch<Organisation>('/organisation', {
        name: org.name.trim(),
        accentColor: org.accentColor || null,
        description: org.description?.trim() || null,
        contactEmail: org.contactEmail?.trim() || null,
        website: org.website?.trim() || null,
        country: org.country?.trim() || null,
        industry: org.industry?.trim() || null,
      });
      setOrg(updated);
      setOriginal(updated);
      setSaved(true);
      announceOrganisationUpdate(updated);
      toast.success('Brand settings saved successfully.');
    } catch (err) {
      toast.error('Failed to save settings.');
      setError(err instanceof ApiError ? err.message : 'Could not save.');
    } finally {
      setSaving(false);
    }
  }

  async function uploadLogo(file: File) {
    if (!org) return;
    setError(null);
    setSaved(false);
    setUploadingLogo(true);
    let uploaded: { key: string; url: string } | null = null;
    try {
      uploaded = await api.upload<{ key: string; url: string }>('/uploads', file, 'image');
      const oldKey = storageKeyFromUrl(org.logoUrl);
      const updated = await api.patch<Organisation>('/organisation', { logoUrl: uploaded.url });
      setOrg(updated);
      setOriginal(updated);
      setSaved(true);
      announceOrganisationUpdate(updated);
      if (oldKey) {
        api.post('/uploads/cleanup', { key: oldKey }).catch(() => undefined);
      }
      toast.success('Logo uploaded successfully.');
    } catch (err) {
      if (uploaded?.key) {
        api.post('/uploads/cleanup', { key: uploaded.key }).catch(() => undefined);
      }
      toast.error('Failed to upload logo.');
      setError(err instanceof ApiError ? err.message : 'Could not upload the logo.');
    } finally {
      setUploadingLogo(false);
    }
  }

  async function removeLogo() {
    if (!org?.logoUrl) return;

    const confirmed = await confirm({
      title: 'Remove Logo?',
      message: 'You are about to remove the brand logo. The default initials will be shown instead.',
      severity: 'destructive',
      confirmText: 'Remove Logo',
    });

    if (!confirmed) return;

    setError(null);
    setSaved(false);
    const oldKey = storageKeyFromUrl(org.logoUrl);
    try {
      const updated = await api.patch<Organisation>('/organisation', { logoUrl: null });
      setOrg(updated);
      setOriginal(updated);
      setSaved(true);
      announceOrganisationUpdate(updated);
      if (oldKey) {
        api.post('/uploads/cleanup', { key: oldKey }).catch(() => undefined);
      }
      toast.success('Logo removed successfully.');
    } catch (err) {
      toast.error('Failed to remove logo.');
      setError(err instanceof ApiError ? err.message : 'Could not remove the logo.');
    }
  }

  if (!org) {
    return error ? <Alert severity="error">{error}</Alert> : <CircularProgress size={24} />;
  }

  const accent = org.accentColor || '#14654A';

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      <Alert severity="info">
        Brand identity is captured when a passport version is published. Existing issued versions stay immutable; republish a product to apply updated branding.
      </Alert>

      <Paper sx={{ p: 4 }}>
        <Typography variant="overline" color="text.secondary">Brand identity</Typography>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 3, my: 3, flexWrap: 'wrap' }}>
          <Box
            sx={{
              width: 96,
              height: 96,
              borderRadius: 2,
              bgcolor: 'grey.100',
              border: '1px solid',
              borderColor: 'divider',
              display: 'grid',
              placeItems: 'center',
              overflow: 'hidden',
              flexShrink: 0,
            }}
          >
            {org.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={org.logoUrl} alt={`${org.name} logo`} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
            ) : (
              <Typography sx={{ fontSize: 32, fontWeight: 600, color: accent }}>{org.name.slice(0, 1).toUpperCase()}</Typography>
            )}
          </Box>
          <Box>
            <Typography variant="h3" sx={{ mb: 1.5 }}>Brand logo</Typography>
            <Box sx={{ display: 'flex', gap: 1, mb: 1 }}>
              <Button component="label" variant="contained" disabled={!canManageBrand || uploadingLogo}>
                {uploadingLogo ? 'Uploading…' : org.logoUrl ? 'Change' : 'Upload'}
                <input
                  hidden
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (file) uploadLogo(file);
                    event.target.value = '';
                  }}
                />
              </Button>
              {org.logoUrl && (
                <Button variant="outlined" color="error" disabled={!canManageBrand || uploadingLogo} onClick={removeLogo}>Remove</Button>
              )}
            </Box>
            <Typography variant="caption" color="text.secondary">PNG, JPEG or WebP · square image recommended · maximum 10 MB</Typography>
          </Box>
        </Box>

        <Divider sx={{ mb: 3 }} />

        <TextField
          label="Brand name"
          fullWidth
          required
          disabled={!canManageBrand}
          value={org.name}
          sx={{ mb: 2 }}
          onChange={(event) => setOrg({ ...org, name: event.target.value })}
        />
        <TextField
          label="Description"
          fullWidth
          multiline
          minRows={3}
          disabled={!canManageBrand}
          value={org.description ?? ''}
          placeholder="Tell consumers about your brand, products and sustainability mission."
          inputProps={{ maxLength: 2000 }}
          helperText={`${org.description?.length ?? 0}/2000`}
          sx={{ mb: 2 }}
          onChange={(event) => setOrg({ ...org, description: event.target.value || null })}
        />
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '220px 1fr' }, gap: 2 }}>
          <TextField
            label="Brand accent colour"
            type="color"
            fullWidth
            disabled={!canManageBrand}
            value={accent}
            helperText={accent.toUpperCase()}
            onChange={(event) => setOrg({ ...org, accentColor: event.target.value })}
          />
          <Paper
            sx={{
              p: 2,
              borderLeft: '5px solid',
              borderLeftColor: accent,
              bgcolor: 'grey.50',
              display: 'flex',
              alignItems: 'center',
              gap: 2,
            }}
          >
            <Box sx={{ width: 36, height: 36, borderRadius: 1, bgcolor: accent, display: 'grid', placeItems: 'center', color: 'white', fontWeight: 600 }}>
              {org.name.slice(0, 1).toUpperCase()}
            </Box>
            <Box>
              <Typography variant="subtitle2">{org.name || 'Your brand'}</Typography>
              <Typography variant="caption" color="text.secondary">Public passport brand preview</Typography>
            </Box>
          </Paper>
        </Box>
      </Paper>

      <Paper sx={{ p: 4 }}>
        <Typography variant="overline" color="text.secondary">Contact information</Typography>
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 2, mt: 2 }}>
          <TextField
            label="Contact email"
            type="email"
            fullWidth
            disabled={!canManageBrand}
            value={org.contactEmail ?? ''}
            placeholder="contact@brand.com"
            onChange={(event) => setOrg({ ...org, contactEmail: event.target.value || null })}
          />
          <TextField
            label="Website"
            type="url"
            fullWidth
            disabled={!canManageBrand}
            value={org.website ?? ''}
            placeholder="https://www.brand.com"
            onChange={(event) => setOrg({ ...org, website: event.target.value || null })}
          />
          <TextField
            label="Country"
            fullWidth
            disabled={!canManageBrand}
            value={org.country ?? ''}
            placeholder="Italy"
            onChange={(event) => setOrg({ ...org, country: event.target.value || null })}
          />
          <TextField
            select
            label="Industry"
            fullWidth
            disabled={!canManageBrand}
            value={org.industry ?? ''}
            onChange={(event) => setOrg({ ...org, industry: event.target.value || null })}
          >
            <MenuItem value=""><em>Not specified</em></MenuItem>
            {INDUSTRIES.map((industry) => <MenuItem key={industry} value={industry}>{industry}</MenuItem>)}
          </TextField>
        </Box>
      </Paper>

      <Paper sx={{ p: 4 }}>
        <Typography variant="overline" color="text.secondary">Public passport address</Typography>
        <TextField
          label="Public slug"
          fullWidth
          disabled
          value={org.publicSlug}
          sx={{ mt: 2 }}
          helperText="This permanent identifier is embedded in issued QR codes and cannot be changed from the brand workspace."
        />
      </Paper>

      <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1.5 }}>
        <Button disabled={!dirty || saving} onClick={() => original && setOrg(original)}>Cancel</Button>
        <Button variant="contained" disabled={!canManageBrand || !dirty || saving || org.name.trim().length < 2} onClick={saveProfile}>
          {saving ? 'Saving…' : 'Save changes'}
        </Button>
      </Box>

      {!canManageBrand && (
        <Typography variant="caption" color="text.secondary">
          You do not have permission to change brand settings.
        </Typography>
      )}
    </Box>
  );
}

export default function SettingsPage() {
  const { hasPermission } = usePermissions();
  const canManageBrand = hasPermission('brand.manage');
  const [tab, setTab] = useState(0);

  return (
    <Box>
      <Typography variant="h1" sx={{ mb: 3 }}>Settings</Typography>
      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 3, borderBottom: '1px solid', borderColor: 'divider' }}>
        <Tab label="Brand profile" />
        {canManageBrand && <Tab label="Audit log" />}
      </Tabs>
      {tab === 0 && <OrganisationTab canManageBrand={canManageBrand} />}
      {tab === 1 && canManageBrand && <AuditLogTab />}
    </Box>
  );
}
