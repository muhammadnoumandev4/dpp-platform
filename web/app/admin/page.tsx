'use client';

import { ReactNode, useCallback, useEffect, useState } from 'react';
import {
  Alert,
  AppBar,
  Box,
  Button,
  ButtonBase,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Drawer,
  IconButton,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Toolbar,
  Typography,
} from '@mui/material';
import MenuIcon from '@mui/icons-material/Menu';
import RefreshIcon from '@mui/icons-material/Refresh';
import DownloadIcon from '@mui/icons-material/Download';
import EmojiEventsIcon from '@mui/icons-material/EmojiEventsOutlined';
import TrendingUpIcon from '@mui/icons-material/TrendingUpOutlined';
import StarsIcon from '@mui/icons-material/StarsOutlined';
import QrCode2Icon from '@mui/icons-material/QrCode2Outlined';
import DashboardIcon from '@mui/icons-material/DashboardOutlined';
import StorefrontIcon from '@mui/icons-material/StorefrontOutlined';
import BadgeIcon from '@mui/icons-material/BadgeOutlined';
import SensorsIcon from '@mui/icons-material/SensorsOutlined';
import HistoryIcon from '@mui/icons-material/HistoryOutlined';
import GroupIcon from '@mui/icons-material/GroupOutlined';
import Inventory2Icon from '@mui/icons-material/Inventory2Outlined';
import VisibilityIcon from '@mui/icons-material/VisibilityOutlined';
import CheckCircleIcon from '@mui/icons-material/CheckCircleOutline';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  Tooltip as RechartsTooltip,
  CartesianGrid,
  Legend,
} from 'recharts';
import { useRouter } from 'next/navigation';
import { api, ApiError } from '@/lib/api/client';
import { useAuth } from '@/lib/auth-context';
import { useConfirm } from '@/components/providers/ConfirmProvider';
import { useToast } from '@/components/providers/ToastProvider';
import { tokens } from '@/theme/tokens';

interface Overview {
  brands: number;
  activeBrands: number;
  suspendedBrands: number;
  brandUsers: number;
  products: number;
  publishedPassports: number;
  scans: number;
}

interface AnalyticsData {
  dailyScans: Array<{ date: string; count: number }>;
  topBrands: Array<{ name: string; passports: number; scans: number }>;
  countryBreakdown: Array<{ country: string; count: number }>;
  browserBreakdown: Array<{ browser: string; count: number }>;
  leaderboards: {
    topBrandAllTime: { id: string; name: string; publicSlug: string; passports: number } | null;
    topBrandThisMonth: { id: string; name: string; publicSlug: string; passportsThisMonth: number } | null;
    mostScannedBrand: { id: string; name: string; publicSlug: string; totalScans: number } | null;
    topTrendingProduct: { productName: string; sku: string; brandName: string; scanCount: number } | null;
  };
}

interface BrandRow {
  id: string;
  name: string;
  publicSlug: string;
  createdAt: string;
  disabledAt: string | null;
  users: number;
  products: number;
  publishedPassports: number;
  scans: number;
}

interface BrandDetail extends Omit<BrandRow, 'users'> {
  logoUrl: string | null;
  users: Array<{
    id: string;
    name: string;
    email: string;
    createdAt: string;
    lastLoginAt: string | null;
    disabledAt: string | null;
  }>;
}

interface PassportRow {
  id: string;
  uuid: string;
  version: number;
  publishedAt: string;
  scansCount: number;
  product: {
    id: string;
    name: string;
    sku: string;
    serialNumber: string | null;
    organisation: { id: string; name: string; publicSlug: string };
  };
  latestSnapshot: any;
}

interface ScanRow {
  id: string;
  timestamp: string;
  browser: string | null;
  os: string | null;
  country: string | null;
  productName: string;
  productSku: string;
  brandName: string;
  passportUuid: string;
}

interface AuditRow {
  id: string;
  action: string;
  entityType: string;
  entityId: string;
  diff: any;
  createdAt: string;
  actor: { name: string; email: string; role: string };
  organisation: { name: string } | null;
}

type SectionKey = 'overview' | 'brands' | 'passports' | 'scans' | 'audit';

const SECTIONS: Array<{ key: SectionKey; label: string; icon: typeof DashboardIcon }> = [
  { key: 'overview', label: 'Overview', icon: DashboardIcon },
  { key: 'brands', label: 'Brands', icon: StorefrontIcon },
  { key: 'passports', label: 'Passports', icon: BadgeIcon },
  { key: 'scans', label: 'Scan Stream', icon: SensorsIcon },
  { key: 'audit', label: 'Audit Trail', icon: HistoryIcon },
];

function getCountryDisplay(code: string | null) {
  if (!code || code === 'XX') return '🌍 Unknown / Local';
  const countries: Record<string, { name: string; flag: string }> = {
    IT: { name: 'Italy', flag: '🇮🇹' },
    US: { name: 'United States', flag: '🇺🇸' },
    GB: { name: 'United Kingdom', flag: '🇬🇧' },
    DE: { name: 'Germany', flag: '🇩🇪' },
    FR: { name: 'France', flag: '🇫🇷' },
    ES: { name: 'Spain', flag: '🇪🇸' },
    PK: { name: 'Pakistan', flag: '🇵🇰' },
    CA: { name: 'Canada', flag: '🇨🇦' },
    AU: { name: 'Australia', flag: '🇦🇺' },
    CH: { name: 'Switzerland', flag: '🇨🇭' },
  };
  const match = countries[code.toUpperCase()];
  return match ? `${match.flag} ${match.name}` : `🌍 ${code.toUpperCase()}`;
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
  onClick?: () => void;
}) {
  const card = (
    <Paper
      sx={{
        p: 3,
        width: '100%',
        minHeight: 126,
        transition: 'transform 160ms ease, box-shadow 160ms ease, border-color 160ms ease',
        ...(onClick && {
          '&:hover': { transform: 'translateY(-2px)', boxShadow: tokens.elevation[2], borderColor: color },
        }),
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
  );
  if (!onClick) return card;
  return (
    <ButtonBase onClick={onClick} sx={{ display: 'block', width: '100%', borderRadius: 2, textAlign: 'left' }}>
      {card}
    </ButtonBase>
  );
}

function LeaderboardCard({
  icon,
  color,
  background,
  title,
  primary,
  secondary,
}: {
  icon: ReactNode;
  color: string;
  background: string;
  title: string;
  primary: string;
  secondary: string;
}) {
  return (
    <Paper sx={{ p: 2.5, height: '100%' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1.5 }}>
        <Box sx={{ width: 36, height: 36, borderRadius: 2, bgcolor: background, color, display: 'grid', placeItems: 'center' }}>
          {icon}
        </Box>
        <Typography variant="caption" sx={{ textTransform: 'uppercase', fontWeight: 700, color: 'text.secondary', letterSpacing: 0.5 }}>
          {title}
        </Typography>
      </Box>
      <Typography variant="h3" sx={{ mb: 0.5, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{primary}</Typography>
      <Typography variant="body2" sx={{ fontWeight: 600, color }}>{secondary}</Typography>
    </Paper>
  );
}

export default function PlatformAdminPage() {
  const router = useRouter();
  const { user, loading, logout } = useAuth();
  const [section, setSection] = useState<SectionKey>('overview');
  const [mobileOpen, setMobileOpen] = useState(false);

  const [overview, setOverview] = useState<Overview | null>(null);
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [brands, setBrands] = useState<BrandRow[] | null>(null);
  const [detail, setDetail] = useState<BrandDetail | null>(null);
  const [brandSearch, setBrandSearch] = useState('');

  const [passports, setPassports] = useState<PassportRow[]>([]);
  const [passportSearch, setPassportSearch] = useState('');
  const [selectedSnapshot, setSelectedSnapshot] = useState<any | null>(null);

  const [scans, setScans] = useState<ScanRow[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditRow[]>([]);

  const [error, setError] = useState<string | null>(null);
  const confirm = useConfirm();
  const toast = useToast();

  const loadOverviewAndBrands = useCallback(async (term = '') => {
    setError(null);
    try {
      const [nextOverview, nextAnalytics, list] = await Promise.all([
        api.get<Overview>('/platform-admin/overview'),
        api.get<AnalyticsData>('/platform-admin/analytics'),
        api.get<{ rows: BrandRow[] }>(`/platform-admin/brands?limit=100${term ? `&search=${encodeURIComponent(term)}` : ''}`),
      ]);
      setOverview(nextOverview);
      setAnalytics(nextAnalytics);
      setBrands(list.rows);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not load platform data.');
    }
  }, []);

  const loadPassports = useCallback(async (term = '') => {
    try {
      const res = await api.get<{ rows: PassportRow[] }>(`/platform-admin/passports?limit=50${term ? `&search=${encodeURIComponent(term)}` : ''}`);
      setPassports(res.rows);
    } catch (err) {
      toast.error('Could not load passports oversight.');
    }
  }, [toast]);

  const loadScans = useCallback(async () => {
    try {
      const res = await api.get<{ rows: ScanRow[] }>('/platform-admin/scans?limit=50');
      setScans(res.rows);
    } catch (err) {
      toast.error('Could not load scan stream.');
    }
  }, [toast]);

  const loadAuditLogs = useCallback(async () => {
    try {
      const res = await api.get<{ rows: AuditRow[] }>('/platform-admin/audit-logs?limit=50');
      setAuditLogs(res.rows);
    } catch (err) {
      toast.error('Could not load audit trail.');
    }
  }, [toast]);

  const refreshAll = useCallback(() => {
    loadOverviewAndBrands(brandSearch);
    if (section === 'passports') loadPassports(passportSearch);
    if (section === 'scans') loadScans();
    if (section === 'audit') loadAuditLogs();
    toast.success('Data refreshed.');
  }, [section, brandSearch, loadAuditLogs, loadOverviewAndBrands, loadPassports, loadScans, passportSearch, toast]);

  useEffect(() => {
    if (!loading) {
      if (!user || user.role !== 'ADMIN') {
        router.replace('/login');
      } else {
        loadOverviewAndBrands();
      }
    }
  }, [loading, user, loadOverviewAndBrands, router]);

  useEffect(() => {
    if (user?.role === 'ADMIN') {
      if (section === 'passports') loadPassports(passportSearch);
      if (section === 'scans') loadScans();
      if (section === 'audit') loadAuditLogs();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [section, user]);

  async function inspectBrand(id: string) {
    try {
      setDetail(await api.get<BrandDetail>(`/platform-admin/brands/${id}`));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not load brand.');
    }
  }

  async function setBrandActive(brand: BrandRow, active: boolean) {
    const verb = active ? 'reactivate' : 'suspend';
    if (!await confirm({
      title: `${verb[0].toUpperCase()}${verb.slice(1)} Brand`,
      message: `Are you sure you want to ${verb} ${brand.name}?`,
      severity: active ? 'info' : 'destructive',
      confirmText: verb[0].toUpperCase() + verb.slice(1)
    })) return;
    try {
      await api.patch(`/platform-admin/brands/${brand.id}/status`, { active });
      setDetail(null);
      await loadOverviewAndBrands(brandSearch);
      toast.success(`Brand ${brand.name} ${active ? 'reactivated' : 'suspended'}.`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : `Could not ${verb} brand.`);
    }
  }

  function downloadCsv(filename: string, content: string) {
    const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  function exportBrandsCsv() {
    if (!brands) return;
    const header = 'Brand,Slug,Status,Users,Products,Passports,Scans,CreatedAt\n';
    const rows = brands.map((b) => `"${b.name}","${b.publicSlug}","${b.disabledAt ? 'Suspended' : 'Active'}",${b.users},${b.products},${b.publishedPassports},${b.scans},"${b.createdAt}"`).join('\n');
    downloadCsv(`notarify_brands_${new Date().toISOString().split('T')[0]}.csv`, header + rows);
  }

  function exportScansCsv() {
    if (!scans) return;
    const header = 'Brand,Product,SKU,Browser,OS,Country,Timestamp\n';
    const rows = scans.map((s) => `"${s.brandName}","${s.productName}","${s.productSku}","${s.browser || ''}","${s.os || ''}","${s.country || ''}","${s.timestamp}"`).join('\n');
    downloadCsv(`notarify_scans_${new Date().toISOString().split('T')[0]}.csv`, header + rows);
  }

  if (loading || !user || user.role !== 'ADMIN' || !overview || !brands) {
    return <Box sx={{ minHeight: '100vh', display: 'grid', placeItems: 'center' }}><CircularProgress /></Box>;
  }

  const lb = analytics?.leaderboards;
  const activeSection = SECTIONS.find((s) => s.key === section)!;

  const sidebarContent = (
    <>
      <Box sx={{ p: 2, display: 'flex', alignItems: 'center', gap: 1.5 }}>
        <Box sx={{ width: 32, height: 32, borderRadius: 1, bgcolor: 'primary.main', display: 'grid', placeItems: 'center', color: 'white', fontWeight: 600 }}>
          N
        </Box>
        <Box>
          <Typography variant="subtitle2" fontWeight={600}>Notarify</Typography>
          <Typography variant="caption" color="text.secondary">Platform Console</Typography>
        </Box>
      </Box>

      <Typography variant="overline" color="text.secondary" sx={{ px: 2, mt: 1 }}>Operate</Typography>
      <List sx={{ py: 0.5 }}>
        {SECTIONS.map((item) => {
          const Icon = item.icon;
          const active = section === item.key;
          return (
            <ListItemButton
              key={item.key}
              selected={active}
              onClick={() => { setSection(item.key); setMobileOpen(false); }}
              sx={{
                borderRadius: tokens.radius.sm,
                mx: 1,
                mb: 0.5,
                '&.Mui-selected': { bgcolor: 'primary.50', color: 'primary.main', fontWeight: 600 },
              }}
            >
              <ListItemIcon sx={{ minWidth: 36, color: active ? 'primary.main' : 'text.secondary' }}>
                <Icon fontSize="small" />
              </ListItemIcon>
              <ListItemText primaryTypographyProps={{ variant: 'subtitle2', fontWeight: active ? 600 : 500 }}>
                {item.label}
              </ListItemText>
            </ListItemButton>
          );
        })}
      </List>

      <Box sx={{ mt: 'auto', p: 2, borderTop: '1px solid', borderColor: 'divider', display: 'flex', alignItems: 'center', gap: 1.5 }}>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography variant="subtitle2" noWrap>{user.name}</Typography>
          <Typography variant="caption" color="text.secondary">Internal Administrator</Typography>
        </Box>
        <ListItemButton onClick={logout} sx={{ px: 1, borderRadius: 1, flexGrow: 0 }}>
          <Typography variant="caption">Sign out</Typography>
        </ListItemButton>
      </Box>
    </>
  );

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', bgcolor: 'background.default' }}>
      <AppBar
        position="sticky"
        color="inherit"
        elevation={0}
        sx={{ display: { md: 'none' }, borderBottom: '1px solid', borderColor: 'divider' }}
      >
        <Toolbar sx={{ px: 2 }}>
          <IconButton edge="start" onClick={() => setMobileOpen(true)} sx={{ mr: 2 }}>
            <MenuIcon />
          </IconButton>
          <Typography variant="subtitle1" fontWeight={600}>Notarify Platform Console</Typography>
        </Toolbar>
      </AppBar>

      <Box sx={{ display: 'flex', flex: 1, minHeight: 0 }}>
        <Box
          sx={{
            width: tokens.size.sidebar.expanded,
            flexShrink: 0,
            borderRight: '1px solid',
            borderColor: 'divider',
            height: '100vh',
            position: 'sticky',
            top: 0,
            display: { xs: 'none', md: 'flex' },
            flexDirection: 'column',
            bgcolor: 'background.paper',
          }}
        >
          {sidebarContent}
        </Box>
        <Drawer
          anchor="left"
          open={mobileOpen}
          onClose={() => setMobileOpen(false)}
          ModalProps={{ keepMounted: true }}
          sx={{
            display: { xs: 'block', md: 'none' },
            '& .MuiDrawer-paper': { boxSizing: 'border-box', width: tokens.size.sidebar.expanded, display: 'flex', flexDirection: 'column' },
          }}
        >
          {sidebarContent}
        </Drawer>

        <Box component="main" sx={{ flex: 1, minWidth: 0, p: { xs: 2, md: 4 } }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: { xs: 'flex-start', sm: 'center' }, gap: 2, mb: 4, flexDirection: { xs: 'column', sm: 'row' } }}>
            <Box>
              <Typography variant="h1" sx={{ mb: 0.5 }}>{activeSection.label}</Typography>
              <Typography variant="body2" color="text.secondary">
                {section === 'overview' && 'Platform-wide totals, leaderboards and engagement trends.'}
                {section === 'brands' && 'Every customer brand with operational totals and lifecycle controls.'}
                {section === 'passports' && 'Published passports across all tenants.'}
                {section === 'scans' && 'Latest consumer scans across the whole platform.'}
                {section === 'audit' && 'Administrative and tenant mutation history.'}
              </Typography>
            </Box>
            <Button variant="outlined" startIcon={<RefreshIcon />} onClick={refreshAll}>Refresh</Button>
          </Box>

          {error && <Alert severity="error" sx={{ mb: 3 }}>{error}</Alert>}
          {overview.suspendedBrands > 0 && section === 'overview' && (
            <Alert severity="warning" sx={{ mb: 3 }}>
              {overview.suspendedBrands} brand account(s) currently suspended.
              <Button size="small" sx={{ ml: 1 }} onClick={() => setSection('brands')}>Review brands</Button>
            </Alert>
          )}

          {section === 'overview' && (
            <>
              <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr 1fr', md: 'repeat(3, 1fr)', lg: 'repeat(6, 1fr)' }, gap: 2, mb: 4 }}>
                <StatCard label="Brands" value={overview.brands} hint="All registered tenants" icon={<StorefrontIcon />} color={tokens.color.primary[600]} background={tokens.color.primary[50]} onClick={() => setSection('brands')} />
                <StatCard label="Active brands" value={overview.activeBrands} hint={`${overview.suspendedBrands} suspended`} icon={<CheckCircleIcon />} color={tokens.color.success.main} background={tokens.color.success.bg} onClick={() => setSection('brands')} />
                <StatCard label="Brand users" value={overview.brandUsers} hint="Active tenant accounts" icon={<GroupIcon />} color={tokens.color.info.main} background={tokens.color.info.bg} />
                <StatCard label="Products" value={overview.products} hint="Across all brands" icon={<Inventory2Icon />} color={tokens.color.chart[4]} background="#F3F0F7" />
                <StatCard label="Published passports" value={overview.publishedPassports} hint="Live consumer passports" icon={<BadgeIcon />} color={tokens.color.warning.main} background={tokens.color.warning.bg} onClick={() => setSection('passports')} />
                <StatCard label="Total scans" value={overview.scans} hint="All-time passport views" icon={<VisibilityIcon />} color={tokens.color.primary[700]} background={tokens.color.primary[100]} onClick={() => setSection('scans')} />
              </Box>

              {lb && (
                <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr', lg: 'repeat(4, 1fr)' }, gap: 2, mb: 4 }}>
                  <LeaderboardCard
                    icon={<EmojiEventsIcon fontSize="small" />}
                    color={tokens.color.primary[600]}
                    background={tokens.color.primary[50]}
                    title="Most Passports (All Time)"
                    primary={lb.topBrandAllTime?.name || '—'}
                    secondary={lb.topBrandAllTime ? `${lb.topBrandAllTime.passports} passports published` : 'No passports yet'}
                  />
                  <LeaderboardCard
                    icon={<TrendingUpIcon fontSize="small" />}
                    color={tokens.color.success.main}
                    background={tokens.color.success.bg}
                    title="Top Creator This Month"
                    primary={lb.topBrandThisMonth?.name || '—'}
                    secondary={lb.topBrandThisMonth ? `+${lb.topBrandThisMonth.passportsThisMonth} passports created` : '0 created this month'}
                  />
                  <LeaderboardCard
                    icon={<StarsIcon fontSize="small" />}
                    color={tokens.color.warning.main}
                    background={tokens.color.warning.bg}
                    title="Most Scanned Brand"
                    primary={lb.mostScannedBrand?.name || '—'}
                    secondary={lb.mostScannedBrand ? `${lb.mostScannedBrand.totalScans} total scans` : '0 scans'}
                  />
                  <LeaderboardCard
                    icon={<QrCode2Icon fontSize="small" />}
                    color={tokens.color.info.main}
                    background={tokens.color.info.bg}
                    title="Top Trending Passport"
                    primary={lb.topTrendingProduct?.productName || '—'}
                    secondary={lb.topTrendingProduct ? `${lb.topTrendingProduct.brandName} (${lb.topTrendingProduct.scanCount} scans)` : 'No scans yet'}
                  />
                </Box>
              )}

              {analytics && (
                <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: '2fr 1fr' }, gap: 3 }}>
                  <Paper sx={{ p: 3 }}>
                    <Typography variant="h3" sx={{ mb: 0.5 }}>Scan volume trend</Typography>
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 2 }}>
                      Scans across all passports, last 30 days
                    </Typography>
                    <Box sx={{ width: '100%', height: 260 }}>
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={analytics.dailyScans}>
                          <defs>
                            <linearGradient id="scanGradient" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor={tokens.color.primary[600]} stopOpacity={0.35} />
                              <stop offset="95%" stopColor={tokens.color.primary[600]} stopOpacity={0} />
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={tokens.color.neutral[200]} />
                          <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                          <YAxis tick={{ fontSize: 12 }} allowDecimals={false} />
                          <RechartsTooltip />
                          <Area type="monotone" dataKey="count" name="Scans" stroke={tokens.color.primary[600]} strokeWidth={2.5} fillOpacity={1} fill="url(#scanGradient)" />
                        </AreaChart>
                      </ResponsiveContainer>
                    </Box>
                  </Paper>

                  <Paper sx={{ p: 3 }}>
                    <Typography variant="h3" sx={{ mb: 0.5 }}>Top brands</Typography>
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 2 }}>
                      Ranked by passports and scan engagement
                    </Typography>
                    <Box sx={{ width: '100%', height: 260 }}>
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={analytics.topBrands}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={tokens.color.neutral[200]} />
                          <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                          <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                          <RechartsTooltip />
                          <Bar dataKey="passports" name="Passports" fill={tokens.color.primary[600]} radius={[4, 4, 0, 0]} />
                          <Bar dataKey="scans" name="Scans" fill={tokens.color.primary[300]} radius={[4, 4, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </Box>
                  </Paper>

                  <Paper sx={{ p: 3 }}>
                    <Typography variant="h3" sx={{ mb: 0.5 }}>Scans by country</Typography>
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 2 }}>
                      Consumer scan locations
                    </Typography>
                    <Box sx={{ width: '100%', height: 220 }}>
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart layout="vertical" data={analytics.countryBreakdown.map((c) => ({ ...c, label: getCountryDisplay(c.country) }))}>
                          <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke={tokens.color.neutral[200]} />
                          <XAxis type="number" tick={{ fontSize: 11 }} allowDecimals={false} />
                          <YAxis type="category" dataKey="label" tick={{ fontSize: 11 }} width={140} />
                          <RechartsTooltip />
                          <Bar dataKey="count" name="Scans" fill={tokens.color.chart[2]} radius={[0, 4, 4, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </Box>
                  </Paper>

                  <Paper sx={{ p: 3 }}>
                    <Typography variant="h3" sx={{ mb: 0.5 }}>Browser distribution</Typography>
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
                      Top user agents scanning passports
                    </Typography>
                    <Box sx={{ width: '100%', height: 220 }}>
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie data={analytics.browserBreakdown} dataKey="count" nameKey="browser" cx="50%" cy="50%" innerRadius={45} outerRadius={75} paddingAngle={4} label>
                            {analytics.browserBreakdown.map((_, index) => (
                              <Cell key={`cell-${index}`} fill={tokens.color.chart[index % tokens.color.chart.length]} />
                            ))}
                          </Pie>
                          <RechartsTooltip />
                          <Legend />
                        </PieChart>
                      </ResponsiveContainer>
                    </Box>
                  </Paper>
                </Box>
              )}
            </>
          )}

          {section === 'brands' && (
            <Paper sx={{ p: 3 }}>
              <Box sx={{ display: 'flex', gap: 2, justifyContent: 'space-between', alignItems: 'center', mb: 3, flexWrap: 'wrap' }}>
                <Typography variant="h3">Customer brands ({overview.brands})</Typography>
                <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                  <Button variant="outlined" startIcon={<DownloadIcon />} onClick={exportBrandsCsv}>Export CSV</Button>
                  <Box component="form" onSubmit={(event) => { event.preventDefault(); loadOverviewAndBrands(brandSearch); }} sx={{ display: 'flex', gap: 1 }}>
                    <TextField size="small" placeholder="Search brand or slug" value={brandSearch} onChange={(event) => setBrandSearch(event.target.value)} />
                    <Button type="submit" variant="outlined">Search</Button>
                  </Box>
                </Box>
              </Box>
              <TableContainer>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell>Brand</TableCell>
                      <TableCell>Status</TableCell>
                      <TableCell align="right">Users</TableCell>
                      <TableCell align="right">Products</TableCell>
                      <TableCell align="right">Passports</TableCell>
                      <TableCell align="right">Scans</TableCell>
                      <TableCell align="right">Actions</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {brands.map((brand) => (
                      <TableRow key={brand.id} hover>
                        <TableCell>
                          <Typography variant="subtitle2">{brand.name}</Typography>
                          <Typography variant="caption" color="text.secondary">{brand.publicSlug}</Typography>
                        </TableCell>
                        <TableCell><Chip size="small" color={brand.disabledAt ? 'error' : 'success'} label={brand.disabledAt ? 'Suspended' : 'Active'} /></TableCell>
                        <TableCell align="right">{brand.users}</TableCell>
                        <TableCell align="right">{brand.products}</TableCell>
                        <TableCell align="right">{brand.publishedPassports}</TableCell>
                        <TableCell align="right">{brand.scans}</TableCell>
                        <TableCell align="right">
                          <Button size="small" onClick={() => inspectBrand(brand.id)}>View</Button>
                          <Button size="small" color={brand.disabledAt ? 'success' : 'error'} onClick={() => setBrandActive(brand, Boolean(brand.disabledAt))}>
                            {brand.disabledAt ? 'Reactivate' : 'Suspend'}
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                    {brands.length === 0 && <TableRow><TableCell colSpan={7}>No matching brands.</TableCell></TableRow>}
                  </TableBody>
                </Table>
              </TableContainer>
            </Paper>
          )}

          {section === 'passports' && (
            <Paper sx={{ p: 3 }}>
              <Box sx={{ display: 'flex', gap: 2, justifyContent: 'space-between', alignItems: 'center', mb: 3, flexWrap: 'wrap' }}>
                <Typography variant="h3">Published passports</Typography>
                <Box component="form" onSubmit={(e) => { e.preventDefault(); loadPassports(passportSearch); }} sx={{ display: 'flex', gap: 1 }}>
                  <TextField size="small" placeholder="Search product, SKU, UUID or brand" value={passportSearch} onChange={(e) => setPassportSearch(e.target.value)} />
                  <Button type="submit" variant="outlined">Search</Button>
                </Box>
              </Box>
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Brand</TableCell>
                      <TableCell>Product / SKU</TableCell>
                      <TableCell>Version</TableCell>
                      <TableCell>Passport UUID</TableCell>
                      <TableCell>Published</TableCell>
                      <TableCell align="right">Scans</TableCell>
                      <TableCell align="right">Actions</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {passports.map((p) => (
                      <TableRow key={p.id} hover>
                        <TableCell><Typography variant="subtitle2">{p.product.organisation.name}</Typography></TableCell>
                        <TableCell>
                          <Typography variant="subtitle2">{p.product.name}</Typography>
                          <Typography variant="caption" color="text.secondary" sx={{ fontFamily: tokens.font.family.mono }}>{p.product.sku}</Typography>
                        </TableCell>
                        <TableCell><Chip size="small" label={`v${p.version}`} color="primary" variant="outlined" /></TableCell>
                        <TableCell sx={{ fontFamily: tokens.font.family.mono, fontSize: 13 }}>{p.uuid}</TableCell>
                        <TableCell>{new Date(p.publishedAt).toLocaleDateString()}</TableCell>
                        <TableCell align="right"><Typography variant="subtitle2" sx={{ fontFamily: tokens.font.family.mono }}>{p.scansCount}</Typography></TableCell>
                        <TableCell align="right">
                          <Button size="small" onClick={() => setSelectedSnapshot(p.latestSnapshot)}>View JSON</Button>
                          <Button size="small" href={`/passport/${p.uuid}`} target="_blank">Open</Button>
                        </TableCell>
                      </TableRow>
                    ))}
                    {passports.length === 0 && <TableRow><TableCell colSpan={7}>No published passports found.</TableCell></TableRow>}
                  </TableBody>
                </Table>
              </TableContainer>
            </Paper>
          )}

          {section === 'scans' && (
            <Paper sx={{ p: 3 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3, flexWrap: 'wrap', gap: 2 }}>
                <Typography variant="h3">Latest scans</Typography>
                <Button variant="outlined" startIcon={<DownloadIcon />} onClick={exportScansCsv}>Export CSV</Button>
              </Box>
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Brand</TableCell>
                      <TableCell>Product</TableCell>
                      <TableCell>Browser / OS</TableCell>
                      <TableCell>Country</TableCell>
                      <TableCell>Timestamp</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {scans.map((s) => (
                      <TableRow key={s.id} hover>
                        <TableCell><Typography variant="subtitle2">{s.brandName}</Typography></TableCell>
                        <TableCell>{s.productName}</TableCell>
                        <TableCell>{[s.browser, s.os].filter(Boolean).join(' / ') || '—'}</TableCell>
                        <TableCell><Chip size="small" variant="outlined" label={getCountryDisplay(s.country)} /></TableCell>
                        <TableCell>{new Date(s.timestamp).toLocaleString()}</TableCell>
                      </TableRow>
                    ))}
                    {scans.length === 0 && <TableRow><TableCell colSpan={5}>No scans recorded yet.</TableCell></TableRow>}
                  </TableBody>
                </Table>
              </TableContainer>
            </Paper>
          )}

          {section === 'audit' && (
            <Paper sx={{ p: 3 }}>
              <Typography variant="h3" sx={{ mb: 3 }}>Administrative audit trail</Typography>
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Actor</TableCell>
                      <TableCell>Action</TableCell>
                      <TableCell>Entity Type / ID</TableCell>
                      <TableCell>Brand</TableCell>
                      <TableCell>Timestamp</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {auditLogs.map((log) => (
                      <TableRow key={log.id} hover>
                        <TableCell>
                          <Typography variant="subtitle2">{log.actor.name}</Typography>
                          <Typography variant="caption" color="text.secondary">{log.actor.email} ({log.actor.role})</Typography>
                        </TableCell>
                        <TableCell><Chip size="small" label={log.action} color={log.action.includes('SUSPENDED') ? 'error' : 'default'} /></TableCell>
                        <TableCell>{log.entityType}: <span style={{ fontFamily: tokens.font.family.mono }}>{log.entityId}</span></TableCell>
                        <TableCell>{log.organisation?.name || 'Platform System'}</TableCell>
                        <TableCell>{new Date(log.createdAt).toLocaleString()}</TableCell>
                      </TableRow>
                    ))}
                    {auditLogs.length === 0 && <TableRow><TableCell colSpan={5}>No audit logs found.</TableCell></TableRow>}
                  </TableBody>
                </Table>
              </TableContainer>
            </Paper>
          )}
        </Box>
      </Box>

      {/* BRAND DETAIL INSPECTION DIALOG */}
      <Dialog open={Boolean(detail)} onClose={() => setDetail(null)} maxWidth="md" fullWidth>
        <DialogTitle>{detail?.name}</DialogTitle>
        <DialogContent>
          {detail && (
            <>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                Brand ID: {detail.id} · Created {new Date(detail.createdAt).toLocaleDateString()}
              </Typography>
              <Typography variant="h3" sx={{ mb: 1.5 }}>Brand Team Roster ({detail.users.length})</Typography>
              {detail.users.map((u) => (
                <Box key={u.id} sx={{ py: 1.25, borderBottom: '1px solid', borderColor: 'divider', display: 'flex', justifyContent: 'space-between' }}>
                  <Box>
                    <Typography variant="subtitle2">{u.name}</Typography>
                    <Typography variant="caption" color="text.secondary">{u.email}</Typography>
                  </Box>
                  <Chip size="small" label={u.disabledAt ? 'Disabled' : 'Active'} color={u.disabledAt ? 'default' : 'success'} />
                </Box>
              ))}
            </>
          )}
        </DialogContent>
        <DialogActions><Button onClick={() => setDetail(null)}>Close</Button></DialogActions>
      </Dialog>

      {/* SNAPSHOT JSON INSPECTOR DIALOG */}
      <Dialog open={Boolean(selectedSnapshot)} onClose={() => setSelectedSnapshot(null)} maxWidth="md" fullWidth>
        <DialogTitle>Immutable Passport Snapshot Data</DialogTitle>
        <DialogContent>
          {selectedSnapshot && (
            <Paper variant="outlined" sx={{ p: 2, bgcolor: 'background.default', overflow: 'auto', maxHeight: 450 }}>
              <pre style={{ margin: 0, fontFamily: tokens.font.family.mono, fontSize: 12 }}>
                {JSON.stringify(selectedSnapshot, null, 2)}
              </pre>
            </Paper>
          )}
        </DialogContent>
        <DialogActions><Button onClick={() => setSelectedSnapshot(null)}>Close</Button></DialogActions>
      </Dialog>
    </Box>
  );
}
