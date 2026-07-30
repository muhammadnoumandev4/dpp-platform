'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Link,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';
import { api, ApiError } from '@/lib/api/client';
import { useConfirm } from '@/components/providers/ConfirmProvider';
import { useToast } from '@/components/providers/ToastProvider';
import type { FullProduct } from '@/lib/types';

interface ProductItemRow {
  id: string;
  serialNumber: string | null;
  batchId: string | null;
  qrUrl: string | null;
  createdAt: string;
  _count: { scans: number };
}

export function InventoryTab({ product, isPublished }: { product: FullProduct; isPublished: boolean }) {
  const [items, setItems] = useState<ProductItemRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [generateCount, setGenerateCount] = useState(10);
  const [batchId, setBatchId] = useState('');
  const [error, setError] = useState<string | null>(null);

  const confirm = useConfirm();
  const toast = useToast();

  const loadItems = useCallback(async () => {
    try {
      const res = await api.get<ProductItemRow[]>(`/products/${product.id}/items`);
      setItems(res);
    } catch {
      setError('Failed to load items.');
    } finally {
      setLoading(false);
    }
  }, [product.id]);

  useEffect(() => {
    if (isPublished) {
      loadItems();
    } else {
      setLoading(false);
    }
  }, [isPublished, loadItems]);

  async function handleGenerate() {
    if (generateCount < 1 || generateCount > 100) {
      setError('You can only generate between 1 and 100 items at a time.');
      return;
    }

    const confirmed = await confirm({
      title: 'Generate QRs?',
      message: `Are you sure you want to generate ${generateCount} new QR codes for this product?`,
      confirmText: 'Generate',
    });

    if (!confirmed) return;

    setGenerating(true);
    setError(null);
    try {
      await api.post(`/products/${product.id}/items`, { count: generateCount, batchId: batchId || undefined });
      await loadItems();
      toast.success(`${generateCount} items generated successfully.`);
    } catch (err) {
      toast.error('Failed to generate items.');
      setError(err instanceof ApiError ? err.message : 'Failed to generate items.');
    } finally {
      setGenerating(false);
    }
  }

  if (!isPublished) {
    return (
      <Alert severity="info" sx={{ mt: 2 }}>
        You must publish this product to generate serialised QR codes.
      </Alert>
    );
  }

  if (loading) {
    return <CircularProgress size={24} sx={{ mt: 4 }} />;
  }

  return (
    <Box sx={{ mt: 2 }}>
      <Typography variant="h6" gutterBottom>
        Item-Level Serialization (QR Inventory)
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Generate unique QR codes for individual units under this passport.
      </Typography>

      <Paper variant="outlined" sx={{ p: 2, mb: 3, display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'center' }}>
        <TextField
          size="small"
          type="number"
          label="Count"
          value={generateCount}
          onChange={(e) => setGenerateCount(Number(e.target.value))}
          inputProps={{ min: 1, max: 100 }}
          sx={{ width: 120 }}
        />
        <TextField
          size="small"
          label="Batch ID (optional)"
          value={batchId}
          onChange={(e) => setBatchId(e.target.value)}
          sx={{ minWidth: 200 }}
        />
        <Button variant="contained" disabled={generating} onClick={handleGenerate}>
          {generating ? 'Generating…' : 'Generate QRs'}
        </Button>
      </Paper>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      <TableContainer component={Paper} variant="outlined" sx={{ overflowX: 'auto' }}>
        <Table size="small" sx={{ minWidth: 620 }}>
          <TableHead>
            <TableRow>
              <TableCell>Serial</TableCell>
              <TableCell>Batch</TableCell>
              <TableCell>Scans</TableCell>
              <TableCell>QR</TableCell>
              <TableCell>Public link</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {items.map((item) => (
              <TableRow key={item.id}>
                <TableCell sx={{ fontFamily: 'monospace' }}>{item.serialNumber}</TableCell>
                <TableCell>{item.batchId || '—'}</TableCell>
                <TableCell>{item._count.scans}</TableCell>
                <TableCell>
                  {item.qrUrl ? (
                    <Button component="a" href={item.qrUrl} download size="small">
                      Download
                    </Button>
                  ) : (
                    '—'
                  )}
                </TableCell>
                <TableCell>
                  <Link href={`/passport/i/${item.id}`} target="_blank" rel="noreferrer">
                    Open
                  </Link>
                </TableCell>
              </TableRow>
            ))}
            {items.length === 0 && (
              <TableRow>
                <TableCell colSpan={5}>
                  <Typography variant="body2" color="text.secondary">
                    No items yet. Generate a batch to create unit-level QRs.
                  </Typography>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
}
