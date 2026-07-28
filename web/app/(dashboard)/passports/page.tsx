'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
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
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline';
import DownloadOutlinedIcon from '@mui/icons-material/DownloadOutlined';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import GridViewOutlinedIcon from '@mui/icons-material/GridViewOutlined';
import HistoryOutlinedIcon from '@mui/icons-material/HistoryOutlined';
import LaunchOutlinedIcon from '@mui/icons-material/LaunchOutlined';
import ViewListOutlinedIcon from '@mui/icons-material/ViewListOutlined';
import { API_URL, api } from '@/lib/api/client';
import { QrCodeDialog } from '@/components/domain/QrCodeDialog';
import { StatusPill } from '@/components/domain/StatusPill';
import { useAuth } from '@/lib/auth-context';
import { useConfirm } from '@/components/providers/ConfirmProvider';
import { useToast } from '@/components/providers/ToastProvider';

interface PassportRow {
  id: string;
  uuid: string;
  version: number;
  createdAt: string;
  publishedAt: string | null;
  unpublishedAt: string | null;
  qrUrl: string | null;
  product: {
    id: string;
    name: string;
    sku: string;
    status: string;
    images: { fileKey: string }[];
  };
  _count: { scans: number };
}

interface PassportVersionRow {
  id: string;
  version: number;
  publishedAt: string;
  publishedBy: { id: string; name: string; email: string };
}

const PAGE_SIZE = 10;

function PassportActions({
  row,
  isLive,
  onHistory,
  onUnpublish,
  unpublishing,
  canManageLifecycle,
}: {
  row: PassportRow;
  isLive: boolean;
  onHistory: () => void;
  onUnpublish: () => void;
  unpublishing: boolean;
  canManageLifecycle: boolean;
}) {
  const router = useRouter();
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>
      {isLive && (
        <Tooltip title="Open public passport">
          <IconButton
            size="small"
            component="a"
            href={`/passport/${row.uuid}`}
            target="_blank"
            aria-label={`Open ${row.product.name} passport`}
          >
            <LaunchOutlinedIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      )}
      <Tooltip title="Edit product">
        <IconButton size="small" onClick={() => router.push(`/products/${row.product.id}`)} aria-label={`Edit ${row.product.name}`}>
          <EditOutlinedIcon fontSize="small" />
        </IconButton>
      </Tooltip>
      {isLive && (
        <Tooltip title="Export PDF">
          <IconButton
            size="small"
            component="a"
            href={`${API_URL}/passport/${row.uuid}/pdf`}
            target="_blank"
            aria-label={`Export ${row.product.name} passport PDF`}
          >
            <DownloadOutlinedIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      )}
      <Tooltip title="Version history">
        <IconButton size="small" onClick={onHistory} aria-label={`View ${row.product.name} version history`}>
          <HistoryOutlinedIcon fontSize="small" />
        </IconButton>
      </Tooltip>
      {isLive && canManageLifecycle && (
        <Button size="small" color="error" disabled={unpublishing} onClick={onUnpublish}>
          Unpublish
        </Button>
      )}
    </Box>
  );
}

export default function PassportsPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [rows, setRows] = useState<PassportRow[] | null>(null);
  const [error, setError] = useState(false);
  const [unpublishing, setUnpublishing] = useState<string | null>(null);
  const [historyProduct, setHistoryProduct] = useState<PassportRow | null>(null);
  const [history, setHistory] = useState<PassportVersionRow[] | null>(null);
  const [historyError, setHistoryError] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sort, setSort] = useState('newest');
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');
  const [page, setPage] = useState(1);
  const canManageLifecycle = Boolean(user?.permissions?.includes('products.publish'));

  function load() {
    setError(false);
    api
      .get<{ rows: PassportRow[] }>('/passports?limit=100')
      .then((result) => setRows(result.rows))
      .catch(() => setError(true));
  }

  useEffect(load, []);
  useEffect(() => setPage(1), [search, statusFilter, sort]);

  const filteredRows = useMemo(() => {
    const term = search.trim().toLowerCase();
    const filtered = (rows ?? []).filter((row) => {
      const isLive = Boolean(row.publishedAt && !row.unpublishedAt);
      const matchesSearch = !term || row.product.name.toLowerCase().includes(term) || row.product.sku.toLowerCase().includes(term) || row.uuid.toLowerCase().includes(term);
      const matchesStatus = statusFilter === 'all' || (statusFilter === 'live' ? isLive : !isLive);
      return matchesSearch && matchesStatus;
    });
    return [...filtered].sort((a, b) => {
      if (sort === 'views') return b._count.scans - a._count.scans;
      if (sort === 'name') return a.product.name.localeCompare(b.product.name);
      return new Date(b.publishedAt ?? b.createdAt).getTime() - new Date(a.publishedAt ?? a.createdAt).getTime();
    });
  }, [rows, search, statusFilter, sort]);

  const pageCount = Math.max(1, Math.ceil(filteredRows.length / PAGE_SIZE));
  const visibleRows = filteredRows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const confirm = useConfirm();
  const toast = useToast();

  async function handleUnpublish(productId: string) {
    const product = rows?.find((r) => r.product.id === productId)?.product;
    const confirmed = await confirm({
      title: 'Unpublish Passport?',
      message: `You are about to unpublish the Product Passport for "${product?.name}". The public URL and QR code will immediately stop resolving until you publish it again.`,
      severity: 'warning',
      confirmText: 'Unpublish',
    });
    
    if (!confirmed) return;

    setUnpublishing(productId);
    try {
      await api.post(`/products/${productId}/unpublish`);
      load();
      toast.success('Passport unpublished successfully.');
    } catch (err) {
      toast.error('Failed to unpublish passport.');
    } finally {
      setUnpublishing(null);
    }
  }

  async function openHistory(row: PassportRow) {
    setHistoryProduct(row);
    setHistory(null);
    setHistoryError(false);
    try {
      setHistory(await api.get<PassportVersionRow[]>(`/products/${row.product.id}/passport-versions`));
    } catch {
      setHistoryError(true);
    }
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 2, mb: 3 }}>
        <Box>
          <Typography variant="h1">Passports</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            {(rows?.length ?? 0).toLocaleString()} issued, versioned consumer passport{rows?.length === 1 ? '' : 's'}
          </Typography>
        </Box>
        <Button variant="contained" startIcon={<AddCircleOutlineIcon />} onClick={() => router.push('/products?create=1')}>
          Create product
        </Button>
      </Box>

      <Paper sx={{ p: 2, mb: 2, display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
        <TextField
          size="small"
          label="Search passports"
          placeholder="Name, SKU or passport ID"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          sx={{ flex: 1, minWidth: 260 }}
        />
        <TextField select size="small" label="Status" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} sx={{ minWidth: 160 }}>
          <MenuItem value="all">All statuses</MenuItem>
          <MenuItem value="live">Published</MenuItem>
          <MenuItem value="unpublished">Unpublished</MenuItem>
        </TextField>
        <TextField select size="small" label="Sort by" value={sort} onChange={(event) => setSort(event.target.value)} sx={{ minWidth: 170 }}>
          <MenuItem value="newest">Newest first</MenuItem>
          <MenuItem value="views">Most viewed</MenuItem>
          <MenuItem value="name">Product name</MenuItem>
        </TextField>
        {(search || statusFilter !== 'all' || sort !== 'newest') && (
          <Button size="small" onClick={() => { setSearch(''); setStatusFilter('all'); setSort('newest'); }}>Clear filters</Button>
        )}
        <ToggleButtonGroup
          exclusive
          size="small"
          value={viewMode}
          onChange={(_, value: 'list' | 'grid' | null) => value && setViewMode(value)}
          aria-label="Passport view"
          sx={{ ml: { sm: 'auto' } }}
        >
          <ToggleButton value="list" aria-label="List view"><ViewListOutlinedIcon fontSize="small" /></ToggleButton>
          <ToggleButton value="grid" aria-label="Grid view"><GridViewOutlinedIcon fontSize="small" /></ToggleButton>
        </ToggleButtonGroup>
      </Paper>

      {error ? (
        <Alert severity="error">
          We couldn&apos;t load passports. <Button size="small" onClick={load}>Retry</Button>
        </Alert>
      ) : !rows ? (
        <CircularProgress size={24} />
      ) : rows.length === 0 ? (
        <Paper sx={{ p: 6, textAlign: 'center', borderStyle: 'dashed' }}>
          <Typography variant="h3" sx={{ mb: 1 }}>No passports published yet</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Create and publish a product to generate its stable passport and QR code.
          </Typography>
          <Button variant="contained" onClick={() => router.push('/products?create=1')}>Create product</Button>
        </Paper>
      ) : filteredRows.length === 0 ? (
        <Paper sx={{ p: 5, textAlign: 'center', borderStyle: 'dashed' }}>
          <Typography variant="h3" sx={{ mb: 1 }}>No matching passports</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>Try changing your search or status filter.</Typography>
          <Button onClick={() => { setSearch(''); setStatusFilter('all'); setSort('newest'); }}>Clear filters</Button>
        </Paper>
      ) : viewMode === 'grid' ? (
        <Grid container spacing={2}>
          {visibleRows.map((row) => {
            const isLive = Boolean(row.publishedAt && !row.unpublishedAt);
            const coverUrl = row.product.images[0] ? `${API_URL}/uploads/${row.product.images[0].fileKey}` : undefined;
            return (
              <Grid item xs={12} sm={6} lg={4} key={row.id}>
                <Paper sx={{ overflow: 'hidden', height: '100%', transition: 'transform 160ms ease, box-shadow 160ms ease', '&:hover': { transform: 'translateY(-2px)', boxShadow: 2 } }}>
                  <Box
                    sx={{
                      height: 152,
                      bgcolor: 'grey.100',
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
                    <Box sx={{ position: 'absolute', top: 12, right: 12, bgcolor: 'background.paper', borderRadius: 1, p: 0.5, boxShadow: 1 }}>
                      {row.qrUrl && <QrCodeDialog qrUrl={row.qrUrl} passportUuid={row.uuid} productName={row.product.name} size={44} />}
                    </Box>
                  </Box>
                  <Box sx={{ p: 2.5 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 2 }}>
                      <Box sx={{ minWidth: 0 }}>
                        <Typography variant="h3" noWrap>{row.product.name}</Typography>
                        <Typography variant="caption" color="text.secondary" sx={{ fontFamily: 'monospace' }}>{row.product.sku}</Typography>
                      </Box>
                      <StatusPill status={isLive ? 'PUBLISHED' : 'UNPUBLISHED'} />
                    </Box>
                    <Grid container spacing={1} sx={{ mt: 1.5 }}>
                      <Grid item xs={4}>
                        <Typography variant="caption" color="text.secondary">Version</Typography>
                        <Typography variant="subtitle2">v{row.version}</Typography>
                      </Grid>
                      <Grid item xs={4}>
                        <Typography variant="caption" color="text.secondary">Views</Typography>
                        <Typography variant="subtitle2">{row._count.scans.toLocaleString()}</Typography>
                      </Grid>
                      <Grid item xs={4}>
                        <Typography variant="caption" color="text.secondary">Published</Typography>
                        <Typography variant="subtitle2">{row.publishedAt ? new Date(row.publishedAt).toLocaleDateString() : '—'}</Typography>
                      </Grid>
                    </Grid>
                    <Box sx={{ mt: 2, pt: 1.5, borderTop: '1px solid', borderColor: 'divider' }}>
                      <PassportActions
                        row={row}
                        isLive={isLive}
                        onHistory={() => openHistory(row)}
                        onUnpublish={() => handleUnpublish(row.product.id)}
                        unpublishing={unpublishing === row.product.id}
                        canManageLifecycle={canManageLifecycle}
                      />
                    </Box>
                  </Box>
                </Paper>
              </Grid>
            );
          })}
        </Grid>
      ) : (
        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Product</TableCell>
                <TableCell>QR</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Version</TableCell>
                <TableCell align="right">Views</TableCell>
                <TableCell>Published</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {visibleRows.map((row) => {
                const isLive = Boolean(row.publishedAt && !row.unpublishedAt);
                return (
                  <TableRow key={row.id} hover>
                    <TableCell>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                        <Avatar
                          variant="rounded"
                          src={row.product.images[0] ? `${API_URL}/uploads/${row.product.images[0].fileKey}` : undefined}
                          sx={{ width: 42, height: 42 }}
                        />
                        <Box>
                          <Typography variant="subtitle2">{row.product.name}</Typography>
                          <Typography variant="caption" color="text.secondary" sx={{ fontFamily: 'monospace' }}>{row.product.sku}</Typography>
                        </Box>
                      </Box>
                    </TableCell>
                    <TableCell>{row.qrUrl && <QrCodeDialog qrUrl={row.qrUrl} passportUuid={row.uuid} productName={row.product.name} size={36} />}</TableCell>
                    <TableCell><StatusPill status={isLive ? 'PUBLISHED' : 'UNPUBLISHED'} /></TableCell>
                    <TableCell>v{row.version}</TableCell>
                    <TableCell align="right" sx={{ fontFamily: 'monospace' }}>{row._count.scans.toLocaleString()}</TableCell>
                    <TableCell>{row.publishedAt ? new Date(row.publishedAt).toLocaleDateString() : '—'}</TableCell>
                    <TableCell align="right">
                      <PassportActions
                        row={row}
                        isLive={isLive}
                        onHistory={() => openHistory(row)}
                        onUnpublish={() => handleUnpublish(row.product.id)}
                        unpublishing={unpublishing === row.product.id}
                        canManageLifecycle={canManageLifecycle}
                      />
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {filteredRows.length > PAGE_SIZE && (
        <Box sx={{ mt: 2, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2, flexWrap: 'wrap' }}>
          <Typography variant="caption" color="text.secondary">
            Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, filteredRows.length)} of {filteredRows.length}
          </Typography>
          <Pagination page={page} count={pageCount} onChange={(_, nextPage) => setPage(nextPage)} />
        </Box>
      )}

      <Dialog open={Boolean(historyProduct)} onClose={() => setHistoryProduct(null)} fullWidth maxWidth="sm">
        <DialogTitle>
          {historyProduct ? `${historyProduct.product.name} — version history` : 'Version history'}
        </DialogTitle>
        <DialogContent>
          {historyError ? (
            <Alert severity="error">We couldn&apos;t load this passport&apos;s publication history.</Alert>
          ) : !history ? (
            <CircularProgress size={24} />
          ) : (
            <Table size="small" aria-label="Passport version history">
              <TableHead>
                <TableRow>
                  <TableCell>Version</TableCell>
                  <TableCell>Published by</TableCell>
                  <TableCell>Published</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {history.map((publication) => (
                  <TableRow key={publication.id}>
                    <TableCell>v{publication.version}</TableCell>
                    <TableCell>{publication.publishedBy.name}</TableCell>
                    <TableCell>{new Date(publication.publishedAt).toLocaleString()}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setHistoryProduct(null)}>Close</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
