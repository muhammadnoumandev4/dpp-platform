'use client';

import { useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Paper,
  TextField,
  Typography,
  Chip,
} from '@mui/material';
import useMediaQuery from '@mui/material/useMediaQuery';
import { useTheme } from '@mui/material/styles';
import DeleteIcon from '@mui/icons-material/DeleteOutline';
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdfOutlined';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import { API_URL, api, ApiError } from '@/lib/api/client';
import type { FullProduct } from '@/lib/types';
import { DropZone } from '@/components/domain/DropZone';
import { useConfirm } from '@/components/providers/ConfirmProvider';
import { useToast } from '@/components/providers/ToastProvider';

export function CertificationsTab({ product, onSaved }: { product: FullProduct; onSaved: () => void }) {
  const [open, setOpen] = useState(false);
  const muiTheme = useTheme();
  const compactScreen = useMediaQuery(muiTheme.breakpoints.down('sm'));
  const [name, setName] = useState('');
  const [issuingAuthority, setIssuingAuthority] = useState('');
  const [issueDate, setIssueDate] = useState('');
  const [expiryDate, setExpiryDate] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const confirm = useConfirm();
  const toast = useToast();

  function resetForm() {
    setName('');
    setIssuingAuthority('');
    setIssueDate('');
    setExpiryDate('');
    setFile(null);
    setError(null);
  }

  async function handleAdd() {
    setSaving(true);
    setError(null);
    let uploadedKey: string | undefined;
    try {
      let fileKey: string | undefined;
      let fileName: string | undefined;
      if (file) {
        const uploaded = await api.upload<{ key: string }>('/uploads', file, 'document');
        fileKey = uploaded.key;
        uploadedKey = uploaded.key;
        fileName = file.name;
      }
      await api.post(`/products/${product.id}/certifications`, {
        name,
        issuingAuthority: issuingAuthority || undefined,
        issueDate: issueDate || undefined,
        expiryDate: expiryDate || undefined,
        fileKey,
        fileName,
      });
      setOpen(false);
      resetForm();
      onSaved();
      toast.success('Certification added successfully.');
    } catch (err) {
      if (uploadedKey) {
        await api.post('/uploads/cleanup', { key: uploadedKey }).catch(() => undefined);
      }
      toast.error('Failed to add certification.');
      setError(err instanceof ApiError ? err.message : 'Could not add certification.');
    } finally {
      setSaving(false);
    }
  }

  async function handleRemove(certificationId: string) {
    const confirmed = await confirm({
      title: 'Delete Certification?',
      message: 'Are you sure you want to remove this certification? This action cannot be undone.',
      severity: 'destructive',
      confirmText: 'Delete'
    });

    if (!confirmed) return;

    try {
      await api.delete(`/products/${product.id}/certifications/${certificationId}`);
      onSaved();
      toast.success('Certification removed successfully.');
    } catch (err) {
      toast.error('Failed to remove certification.');
    }
  }

  return (
    <Paper variant="outlined" sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h3">Certifications</Typography>
        <Button size="small" onClick={() => setOpen(true)}>+ Add certification</Button>
      </Box>

      {product.certifications.length === 0 ? (
        <Box sx={{ textAlign: 'center', py: 4, border: '1px dashed', borderColor: 'divider', borderRadius: 1 }}>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
            No certifications added. Optional, but the strongest trust signal on a public passport.
          </Typography>
          <Button size="small" variant="outlined" onClick={() => setOpen(true)}>Add certification</Button>
        </Box>
      ) : (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          {product.certifications.map((cert) => {
            const isExpired = cert.expiryDate && new Date(cert.expiryDate) < new Date();
            return (
              <Paper key={cert.id} variant="outlined" sx={{ p: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, minWidth: 0 }}>
                  <PictureAsPdfIcon color="action" fontSize="small" />
                  <Box sx={{ minWidth: 0 }}>
                    <Typography variant="subtitle2" noWrap sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      {cert.name}
                      {isExpired && (
                        <Chip size="small" color="warning" label="Expired" sx={{ height: 20, fontSize: 11 }} icon={<ErrorOutlineIcon sx={{ fontSize: 14 }} />} />
                      )}
                    </Typography>
                    <Typography variant="caption" color={isExpired ? 'warning.main' : 'text.secondary'}>
                      {cert.issuingAuthority ?? ''} {cert.expiryDate ? `· expires ${cert.expiryDate.slice(0, 10)}` : ''}
                    </Typography>
                  </Box>
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  {cert.fileKey && (
                    <a href={`${API_URL}/uploads/${cert.fileKey}`} target="_blank" rel="noreferrer">
                      <Button size="small">View PDF</Button>
                    </a>
                  )}
                  <IconButton size="small" onClick={() => handleRemove(cert.id)} aria-label="Remove certification">
                    <DeleteIcon fontSize="small" />
                  </IconButton>
                </Box>
              </Paper>
            );
          })}
        </Box>
      )}

      <Dialog open={open} onClose={() => setOpen(false)} maxWidth="sm" fullWidth fullScreen={compactScreen}>
        <DialogTitle>Add certification</DialogTitle>
        <DialogContent>
          <TextField label="Certification name" fullWidth required sx={{ mt: 1, mb: 2 }} value={name} onChange={(e) => setName(e.target.value)} />
          <TextField label="Issuing authority" fullWidth sx={{ mb: 2 }} value={issuingAuthority} onChange={(e) => setIssuingAuthority(e.target.value)} />
          <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
            <TextField label="Issue date" type="date" fullWidth InputLabelProps={{ shrink: true }} value={issueDate} onChange={(e) => setIssueDate(e.target.value)} />
            <TextField label="Expiry date" type="date" fullWidth InputLabelProps={{ shrink: true }} value={expiryDate} onChange={(e) => setExpiryDate(e.target.value)} />
          </Box>
          <DropZone accept="application/pdf" hint="PDF · maximum 10 MB" onFile={setFile}>
            {file ? file.name : 'Drop certification PDF (optional)'}
          </DropZone>
          {error && <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpen(false)}>Cancel</Button>
          <Button variant="contained" disabled={!name || saving} onClick={handleAdd}>
            {saving ? 'Adding…' : 'Add'}
          </Button>
        </DialogActions>
      </Dialog>
    </Paper>
  );
}
