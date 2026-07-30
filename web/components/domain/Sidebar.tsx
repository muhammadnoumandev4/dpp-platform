'use client';

import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import {
  Avatar,
  Box,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Typography,
} from '@mui/material';
import DashboardIcon from '@mui/icons-material/DashboardOutlined';
import Inventory2Icon from '@mui/icons-material/Inventory2Outlined';
import BadgeIcon from '@mui/icons-material/BadgeOutlined';
import InsightsIcon from '@mui/icons-material/InsightsOutlined';
import HistoryIcon from '@mui/icons-material/HistoryOutlined';
import GroupIcon from '@mui/icons-material/GroupOutlined';
import SettingsIcon from '@mui/icons-material/SettingsOutlined';
import { api } from '@/lib/api/client';
import { useAuth } from '@/lib/auth-context';
import { usePermissions } from '@/lib/hooks/usePermissions';
import { tokens } from '@/theme/tokens';

const MANAGE_ITEMS = [
  { label: 'Dashboard', href: '/', icon: DashboardIcon },
  { label: 'Products', href: '/products', icon: Inventory2Icon },
  { label: 'Product Passports', href: '/passports', icon: BadgeIcon },
  { label: 'Analytics', href: '/analytics', icon: InsightsIcon },
];

// Owner and Manager only — matches the audit.read guard on /audit-log.
const ACTIVITY_ITEM = { label: 'Activity', href: '/activity', icon: HistoryIcon };

export function SidebarContent({ onClose }: { onClose?: () => void }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = useAuth();
  const [organisation, setOrganisation] = useState<{ name: string; logoUrl: string | null; accentColor: string | null } | null>(null);

  useEffect(() => {
    api.get<{ name: string; logoUrl: string | null; accentColor: string | null }>('/organisation').then(setOrganisation).catch(() => {});
    const handleOrganisationUpdate = (event: Event) => {
      setOrganisation((event as CustomEvent<{ name: string; logoUrl: string | null; accentColor: string | null }>).detail);
    };
    window.addEventListener('organisation-updated', handleOrganisationUpdate);
    return () => window.removeEventListener('organisation-updated', handleOrganisationUpdate);
  }, []);

  const { hasPermission } = usePermissions();

  const manageItems = [
    ...MANAGE_ITEMS,
    ...(hasPermission('audit.read') ? [ACTIVITY_ITEM] : []),
  ];

  const adminItems = [
    ...(hasPermission('users.manage')
      ? [{ label: 'Users', href: '/users', icon: GroupIcon }]
      : []),
    ...(hasPermission('brand.manage')
      ? [{ label: 'Settings', href: '/settings', icon: SettingsIcon }]
      : []),
  ];

  const isActive = (href: string) => (href === '/' ? pathname === '/' : pathname.startsWith(href));

  const renderItem = (item: { label: string; href: string; icon: typeof DashboardIcon }) => {
    const Icon = item.icon;
    const active = isActive(item.href);
    return (
      <ListItemButton
        key={item.href}
        selected={active}
        onClick={() => {
          router.push(item.href);
          if (onClose) onClose();
        }}
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
  };

  return (
    <>
      <Box sx={{ p: 2, display: 'flex', alignItems: 'center', gap: 1.5 }}>
        <Box
          sx={{
            width: 32,
            height: 32,
            borderRadius: 1,
            bgcolor: organisation?.accentColor || 'primary.main',
            display: 'grid',
            placeItems: 'center',
            overflow: 'hidden',
            color: 'white',
            fontWeight: 600,
          }}
        >
          {organisation?.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={organisation.logoUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'contain', background: 'white' }} />
          ) : (
            organisation?.name?.slice(0, 1).toUpperCase()
          )}
        </Box>
        <Box>
          <Typography variant="subtitle2" fontWeight={600}>{organisation?.name ?? '…'}</Typography>
          <Typography variant="caption" color="text.secondary">Organisation</Typography>
        </Box>
      </Box>

      <Typography variant="overline" color="text.secondary" sx={{ px: 2, mt: 1 }}>Manage</Typography>
      <List sx={{ py: 0.5 }}>{manageItems.map(renderItem)}</List>

      {adminItems.length > 0 && (
        <>
          <Typography variant="overline" color="text.secondary" sx={{ px: 2, mt: 1 }}>Administer</Typography>
          <List sx={{ py: 0.5 }}>{adminItems.map(renderItem)}</List>
        </>
      )}

      <Box sx={{ mt: 'auto', p: 2, borderTop: '1px solid', borderColor: 'divider', display: 'flex', alignItems: 'center', gap: 1.5 }}>
        <Avatar sx={{ width: 32, height: 32, fontSize: 14 }}>{user?.name?.[0] ?? '?'}</Avatar>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography variant="subtitle2" noWrap>{user?.name}</Typography>
          <Typography variant="caption" color="text.secondary" sx={{ textTransform: 'capitalize' }}>
            {user?.role ? user.role.charAt(0) + user.role.slice(1).toLowerCase() : 'Brand user'}
          </Typography>
        </Box>
        <ListItemButton onClick={() => { logout(); if (onClose) onClose(); }} sx={{ px: 1, borderRadius: 1, flexGrow: 0 }}>
          <Typography variant="caption">Sign out</Typography>
        </ListItemButton>
      </Box>
    </>
  );
}

export function Sidebar() {
  return (
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
      <SidebarContent />
    </Box>
  );
}

import { Drawer } from '@mui/material';

export function MobileSidebar({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Drawer
      anchor="left"
      open={open}
      onClose={onClose}
      ModalProps={{ keepMounted: true }}
      sx={{
        display: { xs: 'block', md: 'none' },
        '& .MuiDrawer-paper': { 
          boxSizing: 'border-box', 
          width: tokens.size.sidebar.expanded,
          bgcolor: 'background.paper',
          display: 'flex',
          flexDirection: 'column'
        },
      }}
    >
      <SidebarContent onClose={onClose} />
    </Drawer>
  );
}
