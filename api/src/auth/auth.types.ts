import { Role } from '@prisma/client';

export interface AuthenticatedUser {
  id: string;
  email: string;
  name: string;
  role: Role;
  /** Null for platform ADMIN; tenant routes must use TenantGuard. */
  organisationId: string | null;
  avatarUrl: string | null;
  language: string;
  createdAt: Date;
  lastLoginAt: Date | null;
  disabledAt: Date | null;
}

/** Narrowed principal after TenantGuard — organisationId is guaranteed. */
export type TenantUser = AuthenticatedUser & { organisationId: string };

export const ACCESS_COOKIE = 'dpp_access_token';
