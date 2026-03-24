import { NextRequest, NextResponse } from 'next/server';

function decodeJWTPayload(token: string): { userId?: string; exp?: number } | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));
    return payload;
  } catch {
    return null;
  }
}

export function middleware(request: NextRequest) {
  const cookieName = process.env.SESSION_COOKIE_NAME || 'meme_radar_session';
  const token = request.cookies.get(cookieName)?.value;

  if (!token) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  const payload = decodeJWTPayload(token);
  if (!payload?.userId) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  // Check expiration
  if (payload.exp && payload.exp * 1000 < Date.now()) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/dashboard/:path*', '/stock/:path*'],
};
