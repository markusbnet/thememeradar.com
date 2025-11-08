import { NextRequest, NextResponse } from 'next/server';
import { validateCSRF } from '@/lib/auth/csrf-middleware';
import { CSRF_COOKIE_NAME } from '@/lib/auth/csrf';

export async function POST(request: NextRequest) {
  try {
    // Validate CSRF token
    const csrfError = validateCSRF(request);
    if (csrfError) {
      return csrfError;
    }

    const cookieName = process.env.SESSION_COOKIE_NAME || 'meme_radar_session';

    // Create response
    const response = NextResponse.json(
      { success: true, message: 'Logged out successfully' },
      { status: 200 }
    );

    // Clear the session cookie
    response.cookies.set(cookieName, '', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 0, // Expire immediately
      path: '/',
    });

    // Clear CSRF cookie
    response.cookies.set(CSRF_COOKIE_NAME, '', {
      httpOnly: false,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 0, // Expire immediately
      path: '/',
    });

    return response;
  } catch (error) {
    console.error('Logout error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
