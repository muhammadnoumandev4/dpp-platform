'use client';

import { useState } from 'react';
import { Alert, Box, Button, IconButton, MenuItem, Paper, TextField, Typography } from '@mui/material';
import DeleteIcon from '@mui/icons-material/DeleteOutline';
import DescriptionIcon from '@mui/icons-material/DescriptionOutlined';
import { API_URL, api, ApiError } from '@/lib/api/client';
import type { DocumentType, FullProduct } from '@/lib/types';
import { DropZone } from '@/components/domain/DropZone';
import { useConfirm } from '@/components/providers/ConfirmProvider';
import { useToast } from '@/components/providers/ToastProvider';

const TYPE_LABELS: Record<DocumentType, string> = {
  MANUAL: 'User manual',
  WARRANTY: 'Warranty',
  DATASHEET: 'Technical datasheet',
};

export function DocumentsTab({ product, onSaved }: { product: FullProduct; onSaved: () => void }) {
  const [type, setType] = useState<DocumentType>('MANUAL');
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const confirm = useConfirm();
  const toast = useToast();

  async function handleUpload(file: File) {
    setUploading(true);
    setError(null);
    let uploadedKey: string | undefined;
    try {
      const uploaded = await api.upload<{ key: string; size: number }>('/uploads', file, 'document');
      uploadedKey = uploaded.key;
      await api.post(`/products/${product.id}/documents`, {
        type,
        fileKey: uploaded.key,
        fileName: file.name,
        sizeBytes: file.size,
      });
      onSaved();
      toast.success('Document uploaded successfully.');
    } catch (err) {
      if (uploadedKey) {
        await api.post('/uploads/cleanup', { key: uploadedKey }).catch(() => undefined);
      }
      toast.error('Failed to upload document.');
      setError(err instanceof ApiError ? err.message : 'Could not upload document.');
    } finally {
      setUploading(false);
    }
  }

  async function handleRemove(documentId: string) {
    const confirmed = await confirm({
      title: 'Delete Document?',
      message: 'Are you sure you want to remove this document? This action cannot be undone.',
      severity: 'destructive',
      confirmText: 'Delete'
    });

    if (!confirmed) return;

    try {
      await api.delete(`/products/${product.id}/documents/${documentId}`);
      onSaved();
      toast.success('Document removed successfully.');
    } catch (err) {
      toast.error('Failed to remove document.');
    }
  }

  return (
    <Paper variant="outlined" sx={{ p: 3 }}>
      <Typography variant="h3" sx={{ mb: 2 }}>Documents</Typography>
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      <Box sx={{ display: 'flex', gap: 2, mb: 3, flexWrap: 'wrap' }}>
        <TextField select label="Document type" size="small" sx={{ minWidth: 200 }} value={type} onChange={(e) => setType(e.target.value as DocumentType)}>
          {(Object.keys(TYPE_LABELS) as DocumentType[]).map((t) => (
            <MenuItem key={t} value={t}>{TYPE_LABELS[t]}</MenuItem>
          ))}
        </TextField>
        <Box sx={{ flex: 1, minWidth: 280 }}>
          <DropZone
            accept="application/pdf,.docx"
            hint="PDF or DOCX · maximum 10 MB"
            disabled={uploading}
            onFile={handleUpload}
          >
            {uploading ? 'Uploading…' : `Drop ${TYPE_LABELS[type].toLowerCase()}`}
          </DropZone>
        </Box>
      </Box>

      {product.documents.length === 0 ? (
        <Typography variant="body2" color="text.secondary">No documents uploaded yet.</Typography>
      ) : (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          {product.documents.map((doc) => (
            <Paper key={doc.id} variant="outlined" sx={{ p: 2, display: 'flex', alignItems: 'center', gap: 1.5 }}>
              <DescriptionIcon color="action" fontSize="small" />
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography variant="subtitle2">{TYPE_LABELS[doc.type]}</Typography>
                <Typography variant="caption" color="text.secondary" noWrap sx={{ display: 'block' }}>{doc.fileName}</Typography>
              </Box>
              <a href={`${API_URL}/uploads/${doc.fileKey}`} target="_blank" rel="noreferrer">
                <Button size="small">View</Button>
              </a>
              <IconButton size="small" onClick={() => handleRemove(doc.id)} aria-label="Remove document">
                <DeleteIcon fontSize="small" />
              </IconButton>
            </Paper>
          ))}
        </Box>
      )}
    </Paper>
  );
}
