/**
 * CSRF Middleware
 * Validates CSRF tokens on state-changing requests (POST, PUT, DELETE)
 */

import { NextRequest, NextResponse } from 'next/server';
import { validateCSRFToken, CSRF_COOKIE_NAME, CSRF_HEADER_NAME } from './csrf';

/**
 * Validate CSRF token for state-changing requests
 * @param request Next.js request object
 * @returns NextResponse with 403 error if validation fails, null if valid
 */
export function validateCSRF(request: NextRequest): NextResponse | null {
  // Only validate on state-changing methods
  const method = request.method.toUpperCase();
  if (!['POST', 'PUT', 'DELETE', 'PATCH'].includes(method)) {
    return null; // Safe methods don't need CSRF protection
  }

  // Get CSRF token from header
  const tokenFromHeader = request.headers.get(CSRF_HEADER_NAME);

  // Get CSRF token from cookie
  const tokenFromCookie = request.cookies.get(CSRF_COOKIE_NAME)?.value || null;

  // Validate tokens
  if (!validateCSRFToken(tokenFromHeader, tokenFromCookie)) {
    return NextResponse.json(
      {
        success: false,
        error: 'Invalid or missing CSRF token',
      },
      { status: 403 }
    );
  }

  return null; // Validation passed
}

/**
 * Check if request needs CSRF validation
 * Some routes (like login/signup) may not require CSRF since user isn't authenticated yet
 * @param pathname Request pathname
 * @returns true if CSRF validation should be skipped
 */
export function shouldSkipCSRF(pathname: string): boolean {
  const skipPaths = [
    '/api/auth/login',
    '/api/auth/signup',
    '/api/health', // Health checks don't need CSRF
  ];

  return skipPaths.includes(pathname);
}
