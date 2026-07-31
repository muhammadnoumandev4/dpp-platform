'use client';

import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { api } from './api/client';
import { UI_SESSION_COOKIE } from './session';

export type Role = 'ADMIN' | 'OWNER' | 'MANAGER' | 'EDITOR';

export interface CurrentUser {
  id: string;
  email: string;
  name: string;
  role: Role;
  organisationId: string | null;
  permissions: string[];
}

interface AuthContextValue {
  user: CurrentUser | null;
  loading: boolean;
  login: (email: string, password: string, next?: string | null) => Promise<void>;
  registerBrand: (data: RegisterBrandInput) => Promise<void>;
  logout: () => void;
}

export interface RegisterBrandInput {
  brandName: string;
  name: string;
  email: string;
  password: string;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const PUBLIC_PATH_PREFIXES = ['/login', '/signup', '/passport', '/invite'];

function isPublicPath(pathname: string) {
  return PUBLIC_PATH_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

function setUiSessionCookie() {
  document.cookie = `${UI_SESSION_COOKIE}=1; Path=/; SameSite=Lax; Max-Age=${7 * 24 * 60 * 60}`;
}

function clearUiSessionCookie() {
  document.cookie = `${UI_SESSION_COOKIE}=; Path=/; Max-Age=0`;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (isPublicPath(pathname)) {
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    api
      .get<CurrentUser>('/auth/me', { redirectOnUnauthorized: false })
      .then((nextUser) => {
        if (cancelled) return;
        setUser(nextUser);
        setUiSessionCookie();
      })
      .catch(() => {
        if (cancelled) return;
        setUser(null);
        clearUiSessionCookie();
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [pathname]);

  const login = useCallback(async (email: string, password: string, next?: string | null) => {
    const result = await api.post<{ user: CurrentUser }>('/auth/login', { email, password });
    setUser(result.user);
    setUiSessionCookie();
    // Honour the `?next=` set by the middleware when it bounced an
    // unauthenticated request, so users land back where they were going.
    // Only same-origin relative paths are accepted (never `//host` or a URL).
    const isSafeNext = Boolean(next) && next!.startsWith('/') && !next!.startsWith('//');
    if (isSafeNext && !isPublicPath(next!)) {
      router.push(next!);
    } else if (result.user.role === 'ADMIN') {
      router.push('/admin');
    } else {
      router.push('/');
    }
  }, [router]);

  const registerBrand = useCallback(async (data: RegisterBrandInput) => {
    const result = await api.post<{ user: CurrentUser }>('/auth/register-brand', data);
    setUser(result.user);
    setUiSessionCookie();
    router.push('/');
  }, [router]);

  const logout = useCallback(async () => {
    await api.post('/auth/logout').catch(() => undefined);
    setUser(null);
    clearUiSessionCookie();
    router.push('/login');
  }, [router]);

  return <AuthContext.Provider value={{ user, loading, login, registerBrand, logout }}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
