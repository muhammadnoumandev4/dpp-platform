'use client';

import React from 'react';
import { usePermissions } from '../lib/hooks/usePermissions';

interface RequirePermissionProps {
  permission: string;
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

export function RequirePermission({ permission, children, fallback = null }: RequirePermissionProps) {
  const { hasPermission } = usePermissions();

  if (!hasPermission(permission)) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
}
