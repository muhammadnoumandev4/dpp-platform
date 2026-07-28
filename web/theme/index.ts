'use client';

import { createTheme } from '@mui/material/styles';
import { tokens } from './tokens';

// Mapping table per Design.pdf §12.4 "Material UI theme mapping".
export const theme = createTheme({
  palette: {
    primary: { main: tokens.color.primary[600], dark: tokens.color.primary[700] },
    error: { main: tokens.color.error.main },
    warning: { main: tokens.color.warning.main },
    success: { main: tokens.color.success.main },
    info: { main: tokens.color.info.main },
    background: { default: tokens.color.neutral[50], paper: tokens.color.neutral[0] },
    divider: tokens.color.neutral[200],
    text: {
      primary: tokens.color.neutral[900],
      secondary: tokens.color.neutral[700],
      disabled: tokens.color.neutral[400],
    },
  },
  typography: {
    fontFamily: tokens.font.family.sans,
    h1: { fontSize: 28, lineHeight: '34px', fontWeight: 600, letterSpacing: '-0.02em' },
    h2: { fontSize: 20, lineHeight: '26px', fontWeight: 600, letterSpacing: '-0.015em' },
    h3: { fontSize: 16, lineHeight: '22px', fontWeight: 600 },
    body1: { fontSize: 15, lineHeight: '24px', fontWeight: 400 },
    body2: { fontSize: 13.5, lineHeight: '21px', fontWeight: 400 },
    subtitle2: { fontSize: 13, lineHeight: '18px', fontWeight: 500 },
    caption: { fontSize: 12, lineHeight: '17px', fontWeight: 400 },
    button: { textTransform: 'none', fontWeight: 500 },
  },
  shape: { borderRadius: tokens.radius.md },
  spacing: 4,
  breakpoints: {
    values: { xs: tokens.breakpoint.xs, sm: tokens.breakpoint.sm, md: tokens.breakpoint.md, lg: tokens.breakpoint.lg, xl: tokens.breakpoint.xl },
  },
  components: {
    MuiButton: {
      defaultProps: { disableRipple: true },
      styleOverrides: { root: { textTransform: 'none' } },
    },
    MuiPaper: {
      defaultProps: { variant: 'outlined' },
      styleOverrides: { root: { backgroundImage: 'none' } },
    },
    MuiCard: {
      defaultProps: { variant: 'outlined' },
    },
  },
});
