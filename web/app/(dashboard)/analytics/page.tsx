'use client';

import dynamic from 'next/dynamic';
import { useEffect, useState } from 'react';
import { Alert, Box, Button, CircularProgress, Paper, Table, TableBody, TableContainer, TableCell, TableHead, TableRow, Typography, ToggleButton, ToggleButtonGroup } from '@mui/material';
import ShowChartIcon from '@mui/icons-material/ShowChart';
import BarChartIcon from '@mui/icons-material/BarChart';
import { api } from '@/lib/api/client';

const AnalyticsCharts = dynamic(() => import('@/components/analytics/AnalyticsCharts'), {
  ssr: false,
  loading: () => (
    <Box sx={{ height: 320, display: 'grid', placeItems: 'center' }}>
      <CircularProgress size={24} aria-label="Loading chart" />
    </Box>
  ),
});

interface DailyPoint { date: string; count: number }
interface MostViewed { id: string; name: string; sku: string; views: number }
interface LatestScan {
  id: number;
  timestamp: string;
  browser: string | null;
  os: string | null;
  country: string | null;
  passport: { product: { name: string; sku: string } };
}
interface Overview {
  scansToday: number;
  scansThisWeek: number;
  mostViewed: MostViewed[];
  latestScans: LatestScan[];
  dailySeries: DailyPoint[];
}

export default function AnalyticsPage() {
  const [data, setData] = useState<Overview | null>(null);
  const [error, setError] = useState(false);
  const [days, setDays] = useState<number>(30);
  const [chartType, setChartType] = useState<'area' | 'bar'>('area');

  function load(selectedDays: number) {
    setError(false);
    api.get<Overview>(`/analytics?days=${selectedDays}`).then(setData).catch(() => setError(true));
  }

  useEffect(() => {
    load(days);
  }, [days]);

  const handleDaysChange = (event: React.MouseEvent<HTMLElement>, newDays: number | null) => {
    if (newDays !== null) {
      setDays(newDays);
    }
  };

  if (error) {
    return (
      <Alert severity="error">
        We couldn&apos;t load analytics. <Button size="small" onClick={() => load(days)}>Retry</Button>
      </Alert>
    );
  }

  if (!data) return <CircularProgress size={24} />;

  // Format dates for XAxis
  const formattedSeries = data.dailySeries.map(p => {
    const d = new Date(p.date);
    return {
      ...p,
      displayDate: d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
    };
  });

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h1">Analytics</Typography>
        <ToggleButtonGroup
          value={days}
          exclusive
          onChange={handleDaysChange}
          aria-label="time range"
          size="small"
        >
          <ToggleButton value={1} aria-label="1 day">1 Day</ToggleButton>
          <ToggleButton value={7} aria-label="7 days">7 Days</ToggleButton>
          <ToggleButton value={30} aria-label="30 days">30 Days</ToggleButton>
        </ToggleButtonGroup>
      </Box>

      <Box sx={{ display: 'flex', gap: 2, mb: 3, flexWrap: 'wrap' }}>
        <Paper variant="outlined" sx={{ p: 3, flex: 1, minWidth: 180 }}>
          <Typography variant="body2" color="text.secondary">Scans today</Typography>
          <Typography sx={{ fontSize: 32, fontWeight: 600, mt: 0.5 }}>{data.scansToday}</Typography>
        </Paper>
        <Paper variant="outlined" sx={{ p: 3, flex: 1, minWidth: 180 }}>
          <Typography variant="body2" color="text.secondary">Scans (last 7 days)</Typography>
          <Typography sx={{ fontSize: 32, fontWeight: 600, mt: 0.5 }}>{data.scansThisWeek}</Typography>
        </Paper>
      </Box>

      <Paper variant="outlined" sx={{ p: 3, mb: 3 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
          <Typography variant="h3">Scans — last {days} day{days > 1 ? 's' : ''}</Typography>
          <ToggleButtonGroup
            value={chartType}
            exclusive
            onChange={(_, val) => val && setChartType(val)}
            size="small"
          >
            <ToggleButton value="area" aria-label="area chart">
              <ShowChartIcon fontSize="small" sx={{ mr: 0.5 }} /> Area
            </ToggleButton>
            <ToggleButton value="bar" aria-label="bar chart">
              <BarChartIcon fontSize="small" sx={{ mr: 0.5 }} /> Bar
            </ToggleButton>
          </ToggleButtonGroup>
        </Box>

        {data.dailySeries.every((p) => p.count === 0) ? (
          <Typography variant="body2" color="text.secondary">No scans recorded in this period.</Typography>
        ) : (
          <Box sx={{ width: '100%', height: 320 }}>
            <AnalyticsCharts data={formattedSeries} chartType={chartType} />
          </Box>
        )}
      </Paper>

      <Box sx={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
        <Paper variant="outlined" sx={{ p: 3, flex: 1, minWidth: 280 }}>
          <Typography variant="h3" sx={{ mb: 2 }}>Most viewed products</Typography>
          {data.mostViewed.length === 0 ? (
            <Typography variant="body2" color="text.secondary">No published passports yet.</Typography>
          ) : (
            data.mostViewed.map((p) => (
              <Box key={p.id} sx={{ display: 'flex', justifyContent: 'space-between', py: 1, borderBottom: '1px solid', borderColor: 'divider' }}>
                <Box>
                  <Typography variant="subtitle2">{p.name}</Typography>
                  <Typography variant="caption" color="text.secondary" sx={{ fontFamily: 'monospace' }}>{p.sku}</Typography>
                </Box>
                <Typography variant="subtitle2" sx={{ fontFamily: 'monospace' }}>{p.views}</Typography>
              </Box>
            ))
          )}
        </Paper>

        <Paper variant="outlined" sx={{ p: 3, flex: 2, minWidth: 0 }}>
          <Typography variant="h3" sx={{ mb: 2 }}>Latest scans</Typography>
          {data.latestScans.length === 0 ? (
            <Typography variant="body2" color="text.secondary">No scans recorded yet.</Typography>
          ) : (
            <TableContainer sx={{ overflowX: 'auto' }}>
              <Table size="small" sx={{ minWidth: 480 }}>
                <TableHead>
                  <TableRow>
                    <TableCell>Product</TableCell>
                    <TableCell>Browser / OS</TableCell>
                    <TableCell>Country</TableCell>
                    <TableCell>When</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {data.latestScans.map((scan) => (
                    <TableRow key={scan.id}>
                      <TableCell>{scan.passport.product.name}</TableCell>
                      <TableCell>{[scan.browser, scan.os].filter(Boolean).join(' / ') || '—'}</TableCell>
                      <TableCell>{scan.country ?? '—'}</TableCell>
                      <TableCell>{new Date(scan.timestamp).toLocaleString()}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </Paper>
      </Box>
    </Box>
  );
}
