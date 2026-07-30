import { Role } from '@prisma/client';

export const RolePermissions: Record<Role, string[]> = {
  [Role.ADMIN]: [
    'platform.read',
    'platform.manage',
    'brands.manage',
    // Intentionally NOT `users.manage` — that permission gates tenant team
    // invitations. Platform staff manage brands via `brands.manage` only.
  ],
  [Role.OWNER]: [
    'brand.read',
    'brand.manage',
    // Team-wide change history. Deliberately not granted to EDITOR: an editor
    // works on their own drafts and has no reason to audit colleagues.
    'audit.read',
    'products.read',
    'products.create',
    'products.update',
    'products.delete',
    'products.publish',
    'users.manage',
  ],
  [Role.MANAGER]: [
    'brand.read',
    'audit.read',
    'products.read',
    'products.create',
    'products.update',
    'products.publish',
  ],
  [Role.EDITOR]: [
    'brand.read',
    'products.read',
    'products.create',
    'products.update',
  ],
};

export function getPermissions(role: Role): string[] {
  return RolePermissions[role] || [];
}
