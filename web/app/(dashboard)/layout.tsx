'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Box, CircularProgress, IconButton, AppBar, Toolbar, Typography } from '@mui/material';
import MenuIcon from '@mui/icons-material/Menu';
import { useAuth } from '@/lib/auth-context';
import { Sidebar, MobileSidebar } from '@/components/domain/Sidebar';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace('/login');
      return;
    }
    if (user.role === 'ADMIN') {
      router.replace('/admin');
    }
  }, [loading, user, router]);

  if (loading || !user || user.role === 'ADMIN') {
    return (
      <Box sx={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      <AppBar
        position="sticky"
        color="inherit"
        elevation={0}
        sx={{
          display: { md: 'none' },
          borderBottom: '1px solid',
          borderColor: 'divider',
        }}
      >
        <Toolbar sx={{ px: 2 }}>
          <IconButton edge="start" onClick={() => setMobileOpen(true)} sx={{ mr: 2 }} aria-label="Open navigation">
            <MenuIcon />
          </IconButton>
          <Typography variant="subtitle1" fontWeight={600}>
            Notarify DPP
          </Typography>
        </Toolbar>
      </AppBar>

      <Box sx={{ display: 'flex', flex: 1, minHeight: 0 }}>
        <Sidebar />
        <MobileSidebar open={mobileOpen} onClose={() => setMobileOpen(false)} />
        <Box component="main" sx={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
          <Box sx={{ flex: 1, p: { xs: 2, md: 4 } }}>
            {children}
          </Box>
          <Box
            component="footer"
            sx={{
              mt: 'auto',
              py: 2.5,
              px: { xs: 2, md: 4 },
              borderTop: '1px solid',
              borderColor: 'divider',
              display: 'flex',
              flexDirection: { xs: 'column', sm: 'row' },
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: 1.5,
              bgcolor: 'background.paper',
            }}
          >
            <Typography variant="body2" color="text.secondary" sx={{ fontSize: 13, display: 'flex', alignItems: 'center', gap: 0.5 }}>
              Powered by <strong>Notarify DPP</strong> · Digital Product Passport Platform
            </Typography>
            <Typography variant="caption" color="text.secondary" sx={{ fontSize: 12 }}>
              © {new Date().getFullYear()} Notarify Inc. All rights reserved.
            </Typography>
          </Box>
        </Box>
      </Box>
    </Box>
  );
}
