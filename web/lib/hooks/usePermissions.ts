import { useCallback } from 'react';
import { useAuth } from '../auth-context';

export function usePermissions() {
  const { user } = useAuth();

  const hasPermission = useCallback((permission: string) => {
    if (!user || !user.permissions) return false;
    return user.permissions.includes(permission);
  }, [user]);

  const hasAnyPermission = useCallback((permissions: string[]) => {
    if (!user || !user.permissions) return false;
    return permissions.some((p) => user.permissions.includes(p));
  }, [user]);

  const hasAllPermissions = useCallback((permissions: string[]) => {
    if (!user || !user.permissions) return false;
    return permissions.every((p) => user.permissions.includes(p));
  }, [user]);

  return { hasPermission, hasAnyPermission, hasAllPermissions, permissions: user?.permissions || [] };
}
