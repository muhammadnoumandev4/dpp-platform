'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  Alert,
  Avatar,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Grid,
  IconButton,
  Menu,
  MenuItem,
  Pagination,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  Typography,
} from '@mui/material';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import GridViewOutlinedIcon from '@mui/icons-material/GridViewOutlined';
import LaunchOutlinedIcon from '@mui/icons-material/LaunchOutlined';
import ViewListOutlinedIcon from '@mui/icons-material/ViewListOutlined';
import VisibilityOutlinedIcon from '@mui/icons-material/VisibilityOutlined';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import Link from 'next/link';
import { API_URL, api, ApiError } from '@/lib/api/client';
import { QrCodeDialog } from '@/components/domain/QrCodeDialog';
import { StatusPill } from '@/components/domain/StatusPill';
import type { CategoryResponse } from '@/lib/types';
import { useAuth } from '@/lib/auth-context';
import { useConfirm } from '@/components/providers/ConfirmProvider';
import { useToast } from '@/components/providers/ToastProvider';

interface ProductRow {
  id: string;
  name: string;
  sku: string;
  status: string;
  views: number;
  hasUnpublishedChanges: boolean;
  createdAt: string;
  passport: { uuid: string; qrUrl: string | null } | null;
  images: { fileKey: string }[];
}

function QuickActions({ row }: { row: ProductRow }) {
  const router = useRouter();
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>
      <Tooltip title="Preview">
        <IconButton size="small" onClick={() => router.push(`/products/${row.id}?tab=preview`)} aria-label={`Preview ${row.name}`}>
          <VisibilityOutlinedIcon fontSize="small" />
        </IconButton>
      </Tooltip>
      <Tooltip title="Edit">
        <IconButton size="small" onClick={() => router.push(`/products/${row.id}`)} aria-label={`Edit ${row.name}`}>
          <EditOutlinedIcon fontSize="small" />
        </IconButton>
      </Tooltip>
      {row.passport?.uuid && (
        <Tooltip title="Open public passport">
          <IconButton
            size="small"
            component="a"
            href={`/passport/${row.passport.uuid}`}
            target="_blank"
            aria-label={`Open ${row.name} public passport`}
          >
            <LaunchOutlinedIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      )}
    </Box>
  );
}

function RowActions({ row, onDeleted, canArchive }: { row: ProductRow; onDeleted: () => void; canArchive: boolean }) {
  const router = useRouter();
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);

  const confirm = useConfirm();
  const toast = useToast();

  async function handleDelete() {
    setAnchor(null);
    const confirmed = await confirm({
      title: 'Delete product?',
      message: `Delete "${row.name}" from the product catalogue? This soft-deletes the draft. An already published passport stays available to consumers until you explicitly unpublish it.`,
      severity: 'destructive',
      confirmText: 'Delete',
      requireConfirmationText: 'DELETE',
    });
    
    if (!confirmed) return;

    try {
      await api.delete(`/products/${row.id}`);
      onDeleted();
      toast.success('Product deleted.');
    } catch (err) {
      toast.error('Failed to delete product.');
    }
  }

  return (
    <>
      <IconButton size="small" onClick={(e) => setAnchor(e.currentTarget)} aria-label="Row actions">
        <MoreVertIcon fontSize="small" />
      </IconButton>
      <Menu anchorEl={anchor} open={Boolean(anchor)} onClose={() => setAnchor(null)}>
        <MenuItem onClick={() => { setAnchor(null); router.push(`/products/${row.id}?tab=preview`); }}>View</MenuItem>
        <MenuItem onClick={() => { setAnchor(null); router.push(`/products/${row.id}`); }}>Edit</MenuItem>
        {row.passport?.uuid && (
          <MenuItem
            onClick={() => { setAnchor(null); window.open(`/passport/${row.passport!.uuid}`, '_blank'); }}
          >
            Open passport
          </MenuItem>
        )}
        {row.passport?.qrUrl && (
          <MenuItem component="a" href={row.passport.qrUrl} download onClick={() => setAnchor(null)}>
            Download QR
          </MenuItem>
        )}
        {canArchive && <MenuItem onClick={handleDelete} sx={{ color: 'error.main' }}>Delete</MenuItem>}
      </Menu>
    </>
  );
}

export default function ProductsListPage() {
  const router = useRouter();
  const { user } = useAuth();
  const searchParams = useSearchParams();
  const [rows, setRows] = useState<ProductRow[] | null>(null);
  const [total, setTotal] = useState(0);
  const [categories, setCategories] = useState<CategoryResponse[]>([]);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [status, setStatus] = useState(searchParams.get('status') ?? '');
  const [categoryId, setCategoryId] = useState('');
  const [page, setPage] = useState(1);
  const [loadError, setLoadError] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(searchParams.get('create') === '1');
  const [name, setName] = useState('');
  const [sku, setSku] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');
  const canManageLifecycle = Boolean(user?.permissions?.includes('products.delete'));
  const canCreate = Boolean(user?.permissions?.includes('products.create'));

  function refresh() {
    setLoadError(false);
    const query = new URLSearchParams({ page: String(page), limit: '25' });
    if (debouncedSearch) query.set('search', debouncedSearch);
    if (status) query.set('status', status);
    if (categoryId) query.set('categoryId', categoryId);
    api
      .get<{ rows: ProductRow[]; total: number }>(`/products?${query}`)
      .then((r) => { setRows(r.rows); setTotal(r.total); })
      .catch(() => setLoadError(true));
  }

  useEffect(() => {
    const timer = window.setTimeout(() => { setPage(1); setDebouncedSearch(search.trim()); }, 300);
    return () => window.clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    refresh();
    // refresh is intentionally derived from the filter state below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch, status, categoryId, page]);

  useEffect(() => {
    api.get<CategoryResponse[]>('/taxonomy/categories').then(setCategories).catch(() => undefined);
  }, []);

  const toast = useToast();

  async function handleCreate() {
    setError(null);
    try {
      const product = await api.post<{ id: string }>('/products', { name, sku });
      setDialogOpen(false);
      setName('');
      setSku('');
      toast.success('Product created successfully.');
      router.push(`/products/${product.id}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not create product.');
    }
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3, gap: 2 }}>
        <Box>
          <Typography variant="h1">Products</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            {total.toLocaleString()} editable catalogue product{total === 1 ? '' : 's'}
          </Typography>
        </Box>
        {canCreate && (
          <Button variant="contained" onClick={() => setDialogOpen(true)}>+ New product</Button>
        )}
      </Box>

      <Paper variant="outlined" sx={{ p: 2, mb: 2, display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'center' }}>
        <TextField
          size="small"
          label="Search products"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          sx={{ flex: 1, minWidth: 240 }}
        />
        <TextField select size="small" label="Status" value={status} onChange={(event) => { setPage(1); setStatus(event.target.value); }} sx={{ minWidth: 160 }}>
          <MenuItem value="">All statuses</MenuItem>
          <MenuItem value="DRAFT">Draft</MenuItem>
          <MenuItem value="PUBLISHED">Published</MenuItem>
        </TextField>
        <TextField select size="small" label="Category" value={categoryId} onChange={(event) => { setPage(1); setCategoryId(event.target.value); }} sx={{ minWidth: 200 }}>
          <MenuItem value="">All categories</MenuItem>
          {categories.map((category) => <MenuItem key={category.id} value={category.id}>{category.name}</MenuItem>)}
        </TextField>
        {(search || status || categoryId) && (
          <Button
            size="small"
            onClick={() => {
              setSearch('');
              setStatus('');
              setCategoryId('');
              setPage(1);
            }}
          >
            Clear filters
          </Button>
        )}
        <ToggleButtonGroup
          exclusive
          size="small"
          value={viewMode}
          onChange={(_, value: 'list' | 'grid' | null) => value && setViewMode(value)}
          aria-label="Product view"
          sx={{ ml: { sm: 'auto' } }}
        >
          <ToggleButton value="list" aria-label="List view"><ViewListOutlinedIcon fontSize="small" /></ToggleButton>
          <ToggleButton value="grid" aria-label="Grid view"><GridViewOutlinedIcon fontSize="small" /></ToggleButton>
        </ToggleButtonGroup>
      </Paper>

      {loadError ? (
        <Alert severity="error">
          We couldn&apos;t load your products. <Button size="small" onClick={refresh}>Retry</Button>
        </Alert>
      ) : !rows ? (
        <CircularProgress size={24} />
      ) : rows.length === 0 ? (
        <Paper variant="outlined" sx={{ p: 6, textAlign: 'center', borderStyle: 'dashed' }}>
          <Typography variant="h3" sx={{ mb: 1 }}>Create your first product</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Add a product, fill in its materials and certifications, then publish it to generate a QR code.
          </Typography>
          {canCreate && <Button variant="contained" onClick={() => setDialogOpen(true)}>New product</Button>}
        </Paper>
      ) : viewMode === 'grid' ? (
        <Grid container spacing={2}>
          {rows.map((row) => {
            const coverUrl = row.images[0] ? `${API_URL}/uploads/${row.images[0].fileKey}` : undefined;
            return (
              <Grid item xs={12} sm={6} lg={4} key={row.id}>
                <Paper
                  sx={{
                    overflow: 'hidden',
                    height: '100%',
                    transition: 'transform 160ms ease, box-shadow 160ms ease',
                    '&:hover': { transform: 'translateY(-2px)', boxShadow: 2 },
                  }}
                >
                  <Box
                    onClick={() => router.push(`/products/${row.id}`)}
                    sx={{
                      height: 224,
                      bgcolor: 'grey.100',
                      cursor: 'pointer',
                      position: 'relative',
                      overflow: 'hidden',
                    }}
                  >
                    {coverUrl && (
                      <Box
                        component="img"
                        src={coverUrl}
                        alt=""
                        sx={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                      />
                    )}
                    <Box sx={{ position: 'absolute', top: 12, right: 12, bgcolor: 'background.paper', borderRadius: 999, boxShadow: 1 }}>
                      <StatusPill status={row.status} />
                    </Box>
                    {!coverUrl && (
                      <Box sx={{ height: '100%', display: 'grid', placeItems: 'center' }}>
                        <Typography variant="caption" color="text.secondary">No product image</Typography>
                      </Box>
                    )}
                  </Box>
                  <Box sx={{ p: 2.5 }}>
                    <Box sx={{ minWidth: 0 }}>
                      <Typography variant="h3" noWrap>{row.name}</Typography>
                      <Typography variant="caption" color="text.secondary" sx={{ fontFamily: 'monospace' }}>{row.sku}</Typography>
                    </Box>
                    {row.hasUnpublishedChanges && (
                      <Typography variant="caption" color="warning.main" sx={{ display: 'block', mt: 1 }}>Unpublished changes</Typography>
                    )}
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mt: 2, pt: 2, borderTop: '1px solid', borderColor: 'divider' }}>
                      <Box>
                        <Typography variant="caption" color="text.secondary">
                          {row.passport ? 'Passport issued' : 'Draft product only'}
                        </Typography>
                        <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                          Created {new Date(row.createdAt).toLocaleDateString()}
                        </Typography>
                      </Box>
                      <Box sx={{ display: 'flex', alignItems: 'center' }}>
                        <QuickActions row={row} />
                        <RowActions row={row} onDeleted={refresh} canArchive={canManageLifecycle} />
                      </Box>
                    </Box>
                  </Box>
                </Paper>
              </Grid>
            );
          })}
        </Grid>
      ) : (
        <TableContainer component={Paper} variant="outlined" sx={{ overflowX: 'auto' }}>
          <Table sx={{ minWidth: 800 }}>
            <TableHead>
              <TableRow>
                <TableCell>Image</TableCell>
                <TableCell>Product name</TableCell>
                <TableCell>SKU</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>QR</TableCell>
                <TableCell align="right">Views</TableCell>
                <TableCell align="right">Actions</TableCell>
                <TableCell width={48} />
              </TableRow>
            </TableHead>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.id} hover sx={{ cursor: 'pointer' }} onClick={() => router.push(`/products/${row.id}`)}>
                  <TableCell>
                    <Avatar variant="rounded" src={row.images[0] ? `${API_URL}/uploads/${row.images[0].fileKey}` : undefined} sx={{ width: 40, height: 40 }} />
                  </TableCell>
                  <TableCell>
                    <Link href={`/products/${row.id}`} style={{ textDecoration: 'none', color: 'inherit' }} onClick={(e) => e.stopPropagation()}>
                      <Typography variant="body2" sx={{ fontWeight: 500, '&:hover': { textDecoration: 'underline' } }}>{row.name}</Typography>
                    </Link>
                    {row.hasUnpublishedChanges && (
                      <Typography variant="caption" color="warning.main" sx={{ display: 'block' }}>Unpublished changes</Typography>
                    )}
                  </TableCell>
                  <TableCell sx={{ fontFamily: 'monospace' }}>{row.sku}</TableCell>
                  <TableCell><StatusPill status={row.status} /></TableCell>
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    {row.passport?.qrUrl ? (
                      <QrCodeDialog
                        qrUrl={row.passport.qrUrl}
                        passportUuid={row.passport.uuid}
                        productName={row.name}
                        size={36}
                      />
                    ) : (
                      '—'
                    )}
                  </TableCell>
                  <TableCell align="right" sx={{ fontFamily: 'monospace' }}>
                    {row.passport ? row.views.toLocaleString() : '—'}
                  </TableCell>
                  <TableCell onClick={(e) => e.stopPropagation()}><QuickActions row={row} /></TableCell>
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <RowActions row={row} onDeleted={refresh} canArchive={canManageLifecycle} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}
      {total > 25 && (
        <Box sx={{ mt: 2, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2, flexWrap: 'wrap' }}>
          <Typography variant="caption" color="text.secondary">
            Showing {(page - 1) * 25 + 1}–{Math.min(page * 25, total)} of {total}
          </Typography>
          <Pagination
            page={page}
            count={Math.ceil(total / 25)}
            onChange={(_, nextPage) => setPage(nextPage)}
          />
        </Box>
      )}

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>New product</DialogTitle>
        <DialogContent>
          <TextField label="Product name" name="name" fullWidth required autoFocus sx={{ mt: 1, mb: 2 }} value={name} onChange={(e) => setName(e.target.value)} />
          <TextField label="SKU" name="sku" fullWidth required helperText="Product model or variant identifier, e.g. LV-NFMM-BRN" value={sku} onChange={(e) => setSku(e.target.value)} />
          {error && <Typography color="error" variant="caption" sx={{ display: 'block', mt: 1 }}>{error}</Typography>}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>Cancel</Button>
          <Button variant="contained" disabled={!name || !sku} onClick={handleCreate}>Create draft</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
