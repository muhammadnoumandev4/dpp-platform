import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { UI_SESSION_COOKIE } from './lib/session';

const PUBLIC_PREFIXES = ['/login', '/signup', '/passport', '/invite'];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isPublic = PUBLIC_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
  if (isPublic) {
    return NextResponse.next();
  }

  const hasSession = Boolean(request.cookies.get(UI_SESSION_COOKIE)?.value);
  const isProtected =
    pathname.startsWith('/admin') ||
    pathname === '/' ||
    pathname.startsWith('/products') ||
    pathname.startsWith('/passports') ||
    pathname.startsWith('/analytics') ||
    pathname.startsWith('/users') ||
    pathname.startsWith('/settings');

  if (!hasSession && isProtected) {
    const login = new URL('/login', request.url);
    login.searchParams.set('next', pathname);
    return NextResponse.redirect(login);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
