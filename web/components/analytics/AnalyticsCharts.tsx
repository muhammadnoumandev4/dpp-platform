'use client';

import {
  AreaChart,
  Area,
  BarChart as RechartsBarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
} from 'recharts';
import { useTheme } from '@mui/material';

interface Point {
  date: string;
  count: number;
  displayDate: string;
}

export default function AnalyticsCharts({
  data,
  chartType,
}: {
  data: Point[];
  chartType: 'area' | 'bar';
}) {
  const theme = useTheme();
  const primaryColor = theme.palette.primary.main;

  return (
    <ResponsiveContainer width="100%" height="100%">
      {chartType === 'area' ? (
        <AreaChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
          <defs>
            <linearGradient id="scanGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={primaryColor} stopOpacity={0.35} />
              <stop offset="95%" stopColor={primaryColor} stopOpacity={0.0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={theme.palette.divider} />
          <XAxis
            dataKey="displayDate"
            axisLine={false}
            tickLine={false}
            tick={{ fontSize: 12, fill: theme.palette.text.secondary }}
            dy={10}
          />
          <YAxis
            axisLine={false}
            tickLine={false}
            tick={{ fontSize: 12, fill: theme.palette.text.secondary }}
            allowDecimals={false}
          />
          <RechartsTooltip
            cursor={{ stroke: primaryColor, strokeWidth: 1, strokeDasharray: '3 3' }}
            contentStyle={{
              borderRadius: 8,
              border: `1px solid ${theme.palette.divider}`,
              boxShadow: theme.shadows[2],
              padding: '8px 12px',
            }}
            formatter={(value: number) => [`${value} scans`, 'Volume']}
            labelStyle={{ color: theme.palette.text.secondary, marginBottom: 4, fontWeight: 600 }}
          />
          <Area
            type="monotone"
            dataKey="count"
            stroke={primaryColor}
            strokeWidth={2.5}
            fillOpacity={1}
            fill="url(#scanGradient)"
            activeDot={{ r: 6, stroke: primaryColor, strokeWidth: 2, fill: '#ffffff' }}
          />
        </AreaChart>
      ) : (
        <RechartsBarChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={theme.palette.divider} />
          <XAxis
            dataKey="displayDate"
            axisLine={false}
            tickLine={false}
            tick={{ fontSize: 12, fill: theme.palette.text.secondary }}
            dy={10}
          />
          <YAxis
            axisLine={false}
            tickLine={false}
            tick={{ fontSize: 12, fill: theme.palette.text.secondary }}
            allowDecimals={false}
          />
          <RechartsTooltip
            cursor={{ fill: theme.palette.action.hover }}
            contentStyle={{
              borderRadius: 8,
              border: `1px solid ${theme.palette.divider}`,
              boxShadow: theme.shadows[1],
            }}
            formatter={(value: number) => [`${value} scans`, 'Scans']}
            labelStyle={{ color: theme.palette.text.secondary, marginBottom: 4 }}
          />
          <Bar dataKey="count" fill={primaryColor} radius={[4, 4, 0, 0]} maxBarSize={40} />
        </RechartsBarChart>
      )}
    </ResponsiveContainer>
  );
}
