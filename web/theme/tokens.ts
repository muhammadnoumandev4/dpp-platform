// Design tokens transcribed from Design.pdf §12.4 — single source of truth.
// Components must bind to semantic names only; never a raw hex in a component.
export const tokens = {
  color: {
    neutral: {
      0: '#FFFFFF',
      50: '#FAFAF9',
      100: '#F5F5F3',
      200: '#E4E4E1',
      300: '#CFCFC9',
      400: '#A8A8A0',
      500: '#8A8A82',
      700: '#5C5C55',
      900: '#1C1C19',
    },
    primary: {
      50: '#E8F1ED',
      100: '#C9E0D6',
      300: '#7FB49E',
      600: '#14654A',
      700: '#0F5340',
      800: '#0A3E30',
    },
    success: { main: '#157F5C', bg: '#E8F1ED', border: '#C9E0D6' },
    warning: { main: '#9A6B0F', bg: '#FBF6EA', border: '#EADFC2' },
    error: { main: '#A32B2B', bg: '#FBF1F1', border: '#E8CFCF' },
    info: { main: '#2A5C86', bg: '#F1F6FA', border: '#CEDCE8' },
    chart: ['#14654A', '#7FB49E', '#2A5C86', '#9A6B0F', '#6B5B8A'],
  },
  font: {
    family: {
      sans: "var(--font-ibm-plex-sans), 'IBM Plex Sans', system-ui, sans-serif",
      mono: "var(--font-ibm-plex-mono), 'IBM Plex Mono', monospace",
    },
    weight: { regular: 400, medium: 500, semibold: 600, bold: 700 },
  },
  space: { 1: 4, 2: 8, 3: 12, 4: 16, 5: 20, 6: 24, 8: 32, 10: 40, 12: 48, 16: 64 },
  radius: { sm: 4, md: 8, lg: 12, xl: 16, full: 999 },
  elevation: {
    1: '0 1px 2px rgba(28,28,25,0.06)',
    2: '0 4px 12px rgba(28,28,25,0.08)',
    3: '0 12px 32px rgba(28,28,25,0.12)',
  },
  size: {
    control: { sm: 32, md: 40, lg: 48 },
    row: { compact: 44, default: 56 },
    sidebar: { expanded: 256, collapsed: 72 },
    topbar: { desktop: 64, mobile: 56 },
  },
  breakpoint: { xs: 0, sm: 600, md: 900, lg: 1280, xl: 1600 },
} as const;
