'use client';

import { ReactNode, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Alert,
  Avatar,
  Box,
  Button,
  ButtonBase,
  Chip,
  CircularProgress,
  Grid,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Tooltip,
  Typography,
} from '@mui/material';
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import BadgeOutlinedIcon from '@mui/icons-material/BadgeOutlined';
import GroupOutlinedIcon from '@mui/icons-material/GroupOutlined';
import InsightsOutlinedIcon from '@mui/icons-material/InsightsOutlined';
import Inventory2OutlinedIcon from '@mui/icons-material/Inventory2Outlined';
import QrCode2OutlinedIcon from '@mui/icons-material/QrCode2Outlined';
import VisibilityOutlinedIcon from '@mui/icons-material/VisibilityOutlined';
import { API_URL, api } from '@/lib/api/client';
import { useAuth } from '@/lib/auth-context';
import { StatusPill } from '@/components/domain/StatusPill';
import { tokens } from '@/theme/tokens';

interface DashboardData {
  totalProducts: number;
  publishedPassports: number;
  generatedQrCodes: number;
  totalPassportViews: number;
  mostViewed: { id: string; name: string; sku: string; views: number }[];
}

interface DailyPoint {
  date: string;
  count: number;
}

interface LatestScan {
  id: number;
  timestamp: string;
  browser: string | null;
  os: string | null;
  country: string | null;
  passport: { product: { name: string; sku: string } };
}

interface AnalyticsData {
  scansToday: number;
  scansThisWeek: number;
  dailySeries: DailyPoint[];
  latestScans: LatestScan[];
}

interface RecentProduct {
  id: string;
  name: string;
  sku: string;
  status: string;
  views: number;
  createdAt: string;
  hasUnpublishedChanges: boolean;
  passport: { uuid: string; publishedAt: string | null; unpublishedAt: string | null } | null;
  images: { fileKey: string }[];
}

interface ProductList {
  rows: RecentProduct[];
  total: number;
}

function StatCard({
  label,
  value,
  hint,
  icon,
  color,
  background,
  onClick,
}: {
  label: string;
  value: number;
  hint: string;
  icon: ReactNode;
  color: string;
  background: string;
  onClick: () => void;
}) {
  return (
    <ButtonBase onClick={onClick} sx={{ display: 'block', width: '100%', borderRadius: 2, textAlign: 'left' }}>
      <Paper
        sx={{
          p: 3,
          width: '100%',
          minHeight: 126,
          transition: 'transform 160ms ease, box-shadow 160ms ease, border-color 160ms ease',
          '&:hover': {
            transform: 'translateY(-2px)',
            boxShadow: tokens.elevation[2],
            borderColor: color,
          },
        }}
      >
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 2 }}>
          <Box>
            <Typography variant="body2" color="text.secondary">{label}</Typography>
            <Typography sx={{ fontSize: 32, lineHeight: 1.1, fontWeight: 600, mt: 1 }}>{value.toLocaleString()}</Typography>
          </Box>
          <Box sx={{ width: 40, height: 40, borderRadius: 2, bgcolor: background, color, display: 'grid', placeItems: 'center' }}>
            {icon}
          </Box>
        </Box>
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1.5 }}>
          {hint}
        </Typography>
      </Paper>
    </ButtonBase>
  );
}

function DailySeriesChart({ series }: { series: DailyPoint[] }) {
  const max = Math.max(1, ...series.map((point) => point.count));
  const total = series.reduce((sum, point) => sum + point.count, 0);

  return (
    <>
      <Box sx={{ display: 'flex', alignItems: 'flex-end', gap: '3px', height: 150, mt: 3 }}>
        {series.map((point) => (
          <Tooltip key={point.date} title={`${new Date(`${point.date}T00:00:00`).toLocaleDateString()}: ${point.count} scan${point.count === 1 ? '' : 's'}`}>
            <Box
              sx={{
                flex: 1,
                height: `${Math.max(3, (point.count / max) * 100)}%`,
                bgcolor: point.count > 0 ? 'primary.main' : 'primary.50',
                borderRadius: '4px 4px 1px 1px',
                minWidth: 3,
                transition: 'height 200ms ease, background-color 160ms ease',
                '&:hover': { bgcolor: 'primary.dark' },
              }}
            />
          </Tooltip>
        ))}
      </Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 1 }}>
        <Typography variant="caption" color="text.secondary">{series[0]?.date ?? ''}</Typography>
        <Typography variant="caption" color="text.secondary">{total.toLocaleString()} total scans</Typography>
        <Typography variant="caption" color="text.secondary">{series.at(-1)?.date ?? ''}</Typography>
      </Box>
    </>
  );
}

function SectionHeader({ title, actionLabel, onAction }: { title: string; actionLabel: string; onAction: () => void }) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2, mb: 2 }}>
      <Typography variant="h3">{title}</Typography>
      <Button size="small" onClick={onAction} endIcon={<ArrowForwardIcon fontSize="small" />}>{actionLabel}</Button>
    </Box>
  );
}

export default function DashboardPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [data, setData] = useState<DashboardData | null>(null);
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [recentProducts, setRecentProducts] = useState<RecentProduct[]>([]);
  const [greeting, setGreeting] = useState('Hello');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  function loadDashboard() {
    setLoading(true);
    setLoadError(false);
    Promise.all([
      api.get<DashboardData>('/dashboard'),
      api.get<AnalyticsData>('/analytics'),
      api.get<ProductList>('/products?page=1&limit=5'),
    ])
      .then(([dashboardData, analyticsData, productData]) => {
        setData(dashboardData);
        setAnalytics(analyticsData);
        setRecentProducts(productData.rows);
      })
      .catch(() => setLoadError(true))
      .finally(() => setLoading(false));
  }

  useEffect(loadDashboard, []);

  useEffect(() => {
    function updateGreeting() {
      const hour = new Date().getHours();
      setGreeting(hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening');
    }

    updateGreeting();
    const timer = window.setInterval(updateGreeting, 60_000);
    return () => window.clearInterval(timer);
  }, []);

  if (loading) {
    return <Box sx={{ minHeight: 360, display: 'grid', placeItems: 'center' }}><CircularProgress size={28} /></Box>;
  }

  if (loadError || !data || !analytics) {
    return (
      <Alert severity="error">
        We couldn&apos;t load your dashboard. <Button size="small" onClick={loadDashboard}>Retry</Button>
      </Alert>
    );
  }

  const firstName = user?.name?.trim().split(/\s+/)[0] || 'there';

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: { xs: 'flex-start', sm: 'center' }, gap: 2, mb: 4, flexDirection: { xs: 'column', sm: 'row' } }}>
        <Box>
          <Typography variant="h1" sx={{ mb: 0.5 }}>{greeting}, {firstName}</Typography>
          <Typography variant="body2" color="text.secondary">Here is what is happening with your product passports.</Typography>
        </Box>
        <Button
          variant="contained"
          size="large"
          startIcon={<AddCircleOutlineIcon />}
          onClick={() => router.push('/products?create=1')}
        >
          Create product
        </Button>
      </Box>

      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={6} lg={3}>
          <StatCard
            label="Total products"
            value={data.totalProducts}
            hint="View and manage products"
            icon={<Inventory2OutlinedIcon />}
            color={tokens.color.primary[600]}
            background={tokens.color.primary[50]}
            onClick={() => router.push('/products')}
          />
        </Grid>
        <Grid item xs={12} sm={6} lg={3}>
          <StatCard
            label="Published passports"
            value={data.publishedPassports}
            hint="Live consumer passports"
            icon={<BadgeOutlinedIcon />}
            color={tokens.color.info.main}
            background={tokens.color.info.bg}
            onClick={() => router.push('/passports')}
          />
        </Grid>
        <Grid item xs={12} sm={6} lg={3}>
          <StatCard
            label="Generated QR codes"
            value={data.generatedQrCodes}
            hint="Ready to print and scan"
            icon={<QrCode2OutlinedIcon />}
            color={tokens.color.warning.main}
            background={tokens.color.warning.bg}
            onClick={() => router.push('/products?status=PUBLISHED')}
          />
        </Grid>
        <Grid item xs={12} sm={6} lg={3}>
          <StatCard
            label="Total passport views"
            value={data.totalPassportViews}
            hint={`${analytics.scansThisWeek.toLocaleString()} in the last 7 days`}
            icon={<VisibilityOutlinedIcon />}
            color={tokens.color.chart[4]}
            background="#F3F0F7"
            onClick={() => router.push('/analytics')}
          />
        </Grid>
      </Grid>

      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid item xs={12} lg={8}>
          <Paper sx={{ p: 3, height: '100%' }}>
            <SectionHeader title="Passport activity" actionLabel="Full analytics" onAction={() => router.push('/analytics')} />
            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
              <Chip label={`${analytics.scansToday} today`} color="primary" variant="outlined" size="small" />
              <Chip label={`${analytics.scansThisWeek} this week`} variant="outlined" size="small" />
            </Box>
            {analytics.dailySeries.every((point) => point.count === 0) ? (
              <Box sx={{ height: 180, display: 'grid', placeItems: 'center' }}>
                <Typography variant="body2" color="text.secondary">No scans in the last 30 days.</Typography>
              </Box>
            ) : (
              <DailySeriesChart series={analytics.dailySeries} />
            )}
          </Paper>
        </Grid>

        <Grid item xs={12} lg={4}>
          <Paper sx={{ p: 3, height: '100%' }}>
            <Typography variant="h3" sx={{ mb: 0.5 }}>Quick actions</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>Common workspace tasks</Typography>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
              <Button fullWidth variant="contained" startIcon={<AddCircleOutlineIcon />} onClick={() => router.push('/products?create=1')}>
                Create a product
              </Button>
              <Button fullWidth variant="outlined" startIcon={<BadgeOutlinedIcon />} onClick={() => router.push('/passports')}>
                Manage passports
              </Button>
              <Button fullWidth variant="outlined" startIcon={<InsightsOutlinedIcon />} onClick={() => router.push('/analytics')}>
                Explore analytics
              </Button>
              {user?.role === 'OWNER' && (
                <Button fullWidth variant="outlined" startIcon={<GroupOutlinedIcon />} onClick={() => router.push('/users')}>
                  Invite a teammate
                </Button>
              )}
            </Box>
          </Paper>
        </Grid>
      </Grid>

      <Grid container spacing={3}>
        <Grid item xs={12} lg={8}>
          <Paper sx={{ overflow: 'hidden' }}>
            <Box sx={{ p: 3, pb: 1 }}>
              <SectionHeader title="Recent products" actionLabel="View all" onAction={() => router.push('/products')} />
            </Box>
            {recentProducts.length === 0 ? (
              <Box sx={{ px: 3, pb: 3 }}>
                <Typography variant="body2" color="text.secondary">No products yet.</Typography>
              </Box>
            ) : (
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Product</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell align="right">Views</TableCell>
                    <TableCell>Created</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {recentProducts.map((product) => (
                    <TableRow
                      key={product.id}
                      hover
                      onClick={() => router.push(`/products/${product.id}`)}
                      sx={{ cursor: 'pointer' }}
                    >
                      <TableCell>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                          <Avatar
                            variant="rounded"
                            src={product.images[0] ? `${API_URL}/uploads/${product.images[0].fileKey}` : undefined}
                            sx={{ width: 38, height: 38 }}
                          />
                          <Box sx={{ minWidth: 0 }}>
                            <Typography variant="subtitle2" noWrap>{product.name}</Typography>
                            <Typography variant="caption" color="text.secondary" sx={{ fontFamily: 'monospace' }}>{product.sku}</Typography>
                          </Box>
                        </Box>
                      </TableCell>
                      <TableCell>
                        <StatusPill status={product.status} />
                        {product.hasUnpublishedChanges && (
                          <Typography variant="caption" color="warning.main" sx={{ display: 'block', mt: 0.5 }}>Changes pending</Typography>
                        )}
                      </TableCell>
                      <TableCell align="right" sx={{ fontFamily: 'monospace' }}>{product.views.toLocaleString()}</TableCell>
                      <TableCell>{new Date(product.createdAt).toLocaleDateString()}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </Paper>
        </Grid>

        <Grid item xs={12} lg={4}>
          <Paper sx={{ p: 3, height: '100%' }}>
            <SectionHeader title="Latest scans" actionLabel="View all" onAction={() => router.push('/analytics')} />
            {analytics.latestScans.length === 0 ? (
              <Typography variant="body2" color="text.secondary">No passport scans recorded yet.</Typography>
            ) : (
              <Box sx={{ display: 'flex', flexDirection: 'column' }}>
                {analytics.latestScans.slice(0, 5).map((scan) => (
                  <Box key={scan.id} sx={{ py: 1.5, borderBottom: '1px solid', borderColor: 'divider' }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 1 }}>
                      <Typography variant="subtitle2" noWrap>{scan.passport.product.name}</Typography>
                      <Typography variant="caption" color="text.secondary" sx={{ whiteSpace: 'nowrap' }}>
                        {new Date(scan.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </Typography>
                    </Box>
                    <Typography variant="caption" color="text.secondary">
                      {[scan.browser, scan.os, scan.country].filter(Boolean).join(' / ') || 'Unknown device'}
                    </Typography>
                  </Box>
                ))}
              </Box>
            )}
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
}
