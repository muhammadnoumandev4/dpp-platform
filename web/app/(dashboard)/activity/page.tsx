'use client';

import { useEffect, useMemo, useState } from 'react';
import NextLink from 'next/link';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  InputAdornment,
  Link,
  MenuItem,
  Paper,
  TextField,
  Typography,
} from '@mui/material';
import type { SvgIconComponent } from '@mui/icons-material';
import ArchiveIcon from '@mui/icons-material/ArchiveOutlined';
import CalendarIcon from '@mui/icons-material/CalendarTodayOutlined';
import DeleteIcon from '@mui/icons-material/DeleteOutlineOutlined';
import DescriptionIcon from '@mui/icons-material/DescriptionOutlined';
import DownloadIcon from '@mui/icons-material/FileDownloadOutlined';
import EditIcon from '@mui/icons-material/EditOutlined';
import GroupIcon from '@mui/icons-material/GroupOutlined';
import HistoryIcon from '@mui/icons-material/HistoryOutlined';
import ImageIcon from '@mui/icons-material/ImageOutlined';
import Inventory2Icon from '@mui/icons-material/Inventory2Outlined';
import PersonAddIcon from '@mui/icons-material/PersonAddAltOutlined';
import PersonIcon from '@mui/icons-material/PersonOutlineOutlined';
import SearchIcon from '@mui/icons-material/SearchOutlined';
import StorefrontIcon from '@mui/icons-material/StorefrontOutlined';
import VerifiedIcon from '@mui/icons-material/VerifiedOutlined';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOffOutlined';
import WorkspacePremiumIcon from '@mui/icons-material/WorkspacePremiumOutlined';
import { api, ApiError } from '@/lib/api/client';
import { usePermissions } from '@/lib/hooks/usePermissions';
import { tokens } from '@/theme/tokens';
import {
  ActivityCategory,
  ActivityItem,
  ActivityTone,
  AuditEntry,
  CATEGORY_LABELS,
  groupByDay,
  timeLabel,
  toActivityItems,
} from '@/lib/activity';

const TONE_STYLES: Record<ActivityTone, { bg: string; color: string }> = {
  publish: { bg: tokens.color.primary[50], color: tokens.color.primary[600] },
  edit: { bg: tokens.color.info.bg, color: tokens.color.info.main },
  team: { bg: tokens.color.warning.bg, color: tokens.color.warning.main },
  brand: { bg: tokens.color.neutral[100], color: tokens.color.neutral[700] },
  destructive: { bg: tokens.color.error.bg, color: tokens.color.error.main },
};

const ACTION_ICONS: Record<string, SvgIconComponent> = {
  PASSPORT_PUBLISHED: VerifiedIcon,
  PASSPORT_UNPUBLISHED: VisibilityOffIcon,
  PRODUCT_CREATED: EditIcon,
  PRODUCT_UPDATED: EditIcon,
  PRODUCT_ARCHIVED: ArchiveIcon,
  IMAGE_ADDED: ImageIcon,
  IMAGE_REMOVED: DeleteIcon,
  COVER_IMAGE_CHANGED: ImageIcon,
  DOCUMENT_ADDED: DescriptionIcon,
  DOCUMENT_REMOVED: DeleteIcon,
  CERTIFICATION_ADDED: WorkspacePremiumIcon,
  CERTIFICATION_REMOVED: DeleteIcon,
  USER_DEACTIVATED: DeleteIcon,
  INVITATION_CREATED: PersonAddIcon,
  INVITATION_ACCEPTED: GroupIcon,
  ORGANISATION_UPDATED: StorefrontIcon,
  BRAND_REGISTERED: StorefrontIcon,
  BRAND_SUSPENDED: DeleteIcon,
};

const DATE_RANGES = [
  { value: 7, label: 'Last 7 days' },
  { value: 30, label: 'Last 30 days' },
  { value: 90, label: 'Last 90 days' },
  { value: 0, label: 'All time' },
];

const CATEGORY_ORDER: ActivityCategory[] = ['products', 'passports', 'team', 'brand'];

function sentenceText(item: ActivityItem) {
  return [item.actor.name, item.lead, item.object?.label ?? '', item.tail].filter(Boolean).join(' ');
}

function csvCell(value: string) {
  return `"${value.replaceAll('"', '""')}"`;
}

function exportCsv(items: ActivityItem[]) {
  const header = ['Date', 'Time', 'Person', 'Activity', 'Area', 'Details'];
  const lines = items.map((item) => {
    const date = new Date(item.createdAt);
    const details = item.changes
      .map((change) => `${change.label}: ${change.from ? `${change.from} → ` : ''}${change.to}`)
      .join('; ');
    return [
      date.toLocaleDateString(),
      timeLabel(item.createdAt),
      item.actor.name,
      sentenceText(item),
      item.categoryLabel,
      details,
    ]
      .map(csvCell)
      .join(',');
  });

  const blob = new Blob([[header.map(csvCell).join(','), ...lines].join('\n')], {
    type: 'text/csv;charset=utf-8;',
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `activity-${new Date().toISOString().slice(0, 10)}.csv`;
  anchor.click();
  URL.revokeObjectURL(url);
}

function ValueChip({ label, struck }: { label: string; struck?: boolean }) {
  return (
    <Box
      component="span"
      sx={{
        px: 1.5,
        py: 0.5,
        borderRadius: `${tokens.radius.sm}px`,
        fontSize: 12,
        lineHeight: '17px',
        border: '1px solid',
        borderColor: struck ? 'divider' : tokens.color.primary[100],
        bgcolor: struck ? tokens.color.neutral[100] : tokens.color.primary[50],
        color: struck ? 'text.secondary' : tokens.color.primary[700],
        textDecoration: struck ? 'line-through' : 'none',
        // Never wider than the row it sits in — long values truncate instead of
        // pushing the page sideways on a phone.
        maxWidth: { xs: '100%', sm: 320 },
        minWidth: 0,
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
      }}
    >
      {label}
    </Box>
  );
}

function ActivityRow({ item, last }: { item: ActivityItem; last: boolean }) {
  const Icon = ACTION_ICONS[item.action] ?? HistoryIcon;
  const tone = TONE_STYLES[item.tone];

  return (
    <Box
      sx={{
        display: 'flex',
        gap: 2,
        p: 4,
        bgcolor: item.destructive ? tokens.color.error.tint : 'transparent',
        borderBottom: last ? 'none' : '1px solid',
        borderColor: 'divider',
      }}
    >
      <Box
        aria-hidden
        sx={{
          width: 36,
          height: 36,
          flexShrink: 0,
          borderRadius: '50%',
          display: 'grid',
          placeItems: 'center',
          bgcolor: tone.bg,
          color: tone.color,
        }}
      >
        <Icon sx={{ fontSize: 18 }} />
      </Box>

      <Box sx={{ minWidth: 0, flex: 1 }}>
        <Typography sx={{ fontSize: 14, lineHeight: '22px' }}>
          <Box component="strong" sx={{ fontWeight: 600 }}>{item.actor.name}</Box>{' '}
          {item.lead}
          {item.object && (
            <>
              {' '}
              {item.object.href ? (
                <Link component={NextLink} href={item.object.href} underline="hover" sx={{ fontWeight: 500 }}>
                  {item.object.label}
                </Link>
              ) : (
                <Box component="span" sx={{ fontWeight: 500 }}>{item.object.label}</Box>
              )}
            </>
          )}
          {item.tail && ` ${item.tail}`}
          {item.destructive && (
            <Box
              component="span"
              sx={{
                ml: 1,
                px: 1.5,
                py: 0.25,
                borderRadius: `${tokens.radius.full}px`,
                fontSize: 11,
                fontWeight: 500,
                whiteSpace: 'nowrap',
                bgcolor: tokens.color.error.bg,
                border: '1px solid',
                borderColor: tokens.color.error.border,
                color: tokens.color.error.main,
              }}
            >
              Removed
            </Box>
          )}
        </Typography>

        <Typography variant="caption" color="text.secondary">
          {timeLabel(item.createdAt)} · {item.categoryLabel}
        </Typography>

        {item.changes.length > 0 && (
          <Box sx={{ mt: 2, display: 'flex', flexDirection: 'column', gap: 1.5 }}>
            {item.changes.map((change) => (
              <Box
                key={change.field}
                sx={{
                  display: 'flex',
                  // Narrow screens put the field name on its own line so the
                  // before → after pair keeps reading as one unit.
                  flexDirection: { xs: 'column', sm: 'row' },
                  alignItems: { xs: 'flex-start', sm: 'center' },
                  gap: { xs: 0.5, sm: 2 },
                  minWidth: 0,
                }}
              >
                <Typography variant="caption" color="text.secondary" sx={{ minWidth: { sm: 120 } }}>
                  {change.label}
                </Typography>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap', minWidth: 0, maxWidth: '100%' }}>
                  {change.from && (
                    <>
                      <ValueChip label={change.from} struck />
                      <Box component="span" aria-hidden sx={{ color: 'text.disabled', fontSize: 13 }}>→</Box>
                    </>
                  )}
                  <ValueChip label={change.to} />
                </Box>
              </Box>
            ))}
          </Box>
        )}
      </Box>
    </Box>
  );
}

export default function ActivityPage() {
  const { hasPermission } = usePermissions();
  const canRead = hasPermission('audit.read');

  const [entries, setEntries] = useState<AuditEntry[] | null>(null);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const [person, setPerson] = useState('all');
  const [product, setProduct] = useState('all');
  const [rangeDays, setRangeDays] = useState(30);
  const [category, setCategory] = useState<ActivityCategory | 'all'>('all');

  async function load(cursor?: string) {
    setError(null);
    if (cursor) setLoadingMore(true);
    try {
      const since =
        rangeDays > 0
          ? `&since=${new Date(Date.now() - rangeDays * 24 * 60 * 60 * 1000).toISOString()}`
          : '';
      const result = await api.get<{ rows: AuditEntry[]; nextCursor: string | null }>(
        `/audit-log?limit=25${since}${cursor ? `&cursor=${cursor}` : ''}`,
      );
      setEntries((current) => (cursor && current ? [...current, ...result.rows] : result.rows));
      setNextCursor(result.nextCursor);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not load activity.');
    } finally {
      setLoadingMore(false);
    }
  }

  useEffect(() => {
    if (!canRead) return;
    setEntries(null);
    setNextCursor(null);
    load();
    // Reload when the date window changes so pagination stays inside that range.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional: rangeDays drives a fresh first page
  }, [canRead, rangeDays]);

  const items = useMemo(() => toActivityItems(entries ?? []), [entries]);

  const people = useMemo(() => {
    const byEmail = new Map<string, string>();
    items.forEach((item) => byEmail.set(item.actor.email, item.actor.name));
    return [...byEmail].map(([email, name]) => ({ email, name })).sort((a, b) => a.name.localeCompare(b.name));
  }, [items]);

  const products = useMemo(() => {
    const names = new Set<string>();
    items.forEach((item) => {
      if (item.category === 'products' || item.category === 'passports') {
        if (item.object?.label) names.add(item.object.label);
      }
    });
    return [...names].sort((a, b) => a.localeCompare(b));
  }, [items]);

  // Person / product / search run on the server-scoped window already loaded.
  const preCategory = useMemo(() => {
    const term = search.trim().toLowerCase();
    return items.filter((item) => {
      if (term && !item.searchText.includes(term)) return false;
      if (person !== 'all' && item.actor.email !== person) return false;
      if (product !== 'all' && item.object?.label !== product) return false;
      return true;
    });
  }, [items, search, person, product]);

  const counts = useMemo(() => {
    const result: Record<string, number> = { all: preCategory.length };
    CATEGORY_ORDER.forEach((key) => {
      result[key] = preCategory.filter((item) => item.category === key).length;
    });
    return result;
  }, [preCategory]);

  const visible = useMemo(
    () => (category === 'all' ? preCategory : preCategory.filter((item) => item.category === category)),
    [preCategory, category],
  );

  const timeline = useMemo(() => groupByDay(visible), [visible]);

  if (!canRead) {
    return <Alert severity="info">Only an Owner or Manager can view the team&apos;s activity history.</Alert>;
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 2, mb: 6, flexWrap: 'wrap' }}>
        <Box>
          <Typography variant="h1">Activity</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1, maxWidth: 560 }}>
            Everything your team has changed, in plain language. Nothing here affects your live passports.
          </Typography>
        </Box>
        <Button
          variant="outlined"
          size="small"
          startIcon={<DownloadIcon sx={{ fontSize: 18 }} />}
          disabled={visible.length === 0}
          onClick={() => exportCsv(visible)}
        >
          Export
        </Button>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 4 }}>{error}</Alert>}

      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, mb: 4 }}>
        <TextField
          size="small"
          placeholder="Search by product, person or change"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          sx={{ flex: '1 1 260px', maxWidth: 320 }}
          inputProps={{ 'aria-label': 'Search activity' }}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon sx={{ fontSize: 18, color: 'text.disabled' }} />
              </InputAdornment>
            ),
          }}
        />
        <TextField
          select
          size="small"
          value={person}
          onChange={(event) => setPerson(event.target.value)}
          inputProps={{ 'aria-label': 'Filter by person' }}
          sx={{ minWidth: 160 }}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <PersonIcon sx={{ fontSize: 18, color: 'text.disabled' }} />
              </InputAdornment>
            ),
          }}
        >
          <MenuItem value="all">Everyone</MenuItem>
          {people.map((entry) => (
            <MenuItem key={entry.email} value={entry.email}>{entry.name}</MenuItem>
          ))}
        </TextField>
        <TextField
          select
          size="small"
          value={products.includes(product) ? product : 'all'}
          onChange={(event) => setProduct(event.target.value)}
          inputProps={{ 'aria-label': 'Filter by product' }}
          sx={{ minWidth: 180 }}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <Inventory2Icon sx={{ fontSize: 18, color: 'text.disabled' }} />
              </InputAdornment>
            ),
          }}
        >
          <MenuItem value="all">Any product</MenuItem>
          {products.map((name) => (
            <MenuItem key={name} value={name}>{name}</MenuItem>
          ))}
        </TextField>
        <TextField
          select
          size="small"
          value={rangeDays}
          onChange={(event) => setRangeDays(Number(event.target.value))}
          inputProps={{ 'aria-label': 'Filter by date range' }}
          sx={{ minWidth: 160 }}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <CalendarIcon sx={{ fontSize: 16, color: 'text.disabled' }} />
              </InputAdornment>
            ),
          }}
        >
          {DATE_RANGES.map((range) => (
            <MenuItem key={range.value} value={range.value}>{range.label}</MenuItem>
          ))}
        </TextField>
      </Box>

      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.5, mb: 5 }}>
        {(['all', ...CATEGORY_ORDER] as const).map((key) => {
          const selected = category === key;
          return (
            <Chip
              key={key}
              variant="outlined"
              onClick={() => setCategory(key)}
              aria-pressed={selected}
              label={
                <Box component="span" sx={{ display: 'inline-flex', gap: 1, alignItems: 'baseline' }}>
                  {key === 'all' ? 'All' : CATEGORY_LABELS[key]}
                  <Box component="span" sx={{ color: 'text.secondary', fontSize: 12 }}>{counts[key] ?? 0}</Box>
                </Box>
              }
              sx={{
                borderRadius: `${tokens.radius.full}px`,
                bgcolor: selected ? tokens.color.primary[50] : 'background.paper',
                borderColor: selected ? 'primary.main' : 'divider',
                color: selected ? 'primary.main' : 'text.primary',
                fontWeight: selected ? 600 : 400,
                '&:hover': { bgcolor: selected ? tokens.color.primary[50] : tokens.color.neutral[100] },
              }}
            />
          );
        })}
      </Box>

      {entries === null ? (
        <Box sx={{ py: 8, display: 'grid', placeItems: 'center' }}>
          <CircularProgress size={24} aria-label="Loading activity" />
        </Box>
      ) : visible.length === 0 ? (
        <Paper sx={{ p: 8, textAlign: 'center', borderRadius: `${tokens.radius.lg}px` }}>
          <Typography variant="body2" color="text.secondary">
            {items.length === 0
              ? 'Nothing has changed yet. Activity will appear here as your team works.'
              : 'No activity matches these filters.'}
          </Typography>
        </Paper>
      ) : (
        timeline.map((day) => (
          <Box key={day.key} sx={{ mb: 6 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
              <Typography variant="overline" color="text.secondary" sx={{ letterSpacing: '0.08em' }}>
                {day.label}
              </Typography>
              <Box sx={{ flex: 1, height: '1px', bgcolor: 'divider' }} />
            </Box>
            <Paper sx={{ borderRadius: `${tokens.radius.lg}px`, overflow: 'hidden' }}>
              {day.items.map((item, index) => (
                <ActivityRow key={item.id} item={item} last={index === day.items.length - 1} />
              ))}
            </Paper>
          </Box>
        ))
      )}

      {nextCursor && (
        <Box sx={{ display: 'flex', justifyContent: 'center', mt: 6 }}>
          <Button variant="outlined" disabled={loadingMore} onClick={() => load(nextCursor)}>
            {loadingMore ? 'Loading…' : 'Show older activity'}
          </Button>
        </Box>
      )}
    </Box>
  );
}
