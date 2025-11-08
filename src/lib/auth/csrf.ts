/**
 * CSRF (Cross-Site Request Forgery) Protection
 * Generates and validates CSRF tokens to prevent CSRF attacks
 */

import { randomBytes } from 'crypto';

/**
 * Generate a cryptographically secure CSRF token
 * @returns 64-character hex string
 */
export function generateCSRFToken(): string {
  // Generate 32 random bytes and convert to hex (64 characters)
  return randomBytes(32).toString('hex');
}

/**
 * Validate CSRF token from request against cookie value
 * @param tokenFromHeader CSRF token from X-CSRF-Token header
 * @param tokenFromCookie CSRF token from cookie
 * @returns true if tokens match and are valid, false otherwise
 */
export function validateCSRFToken(
  tokenFromHeader: string | null,
  tokenFromCookie: string | null
): boolean {
  // Both tokens must exist
  if (!tokenFromHeader || !tokenFromCookie) {
    return false;
  }

  // Tokens must be non-empty strings
  if (
    typeof tokenFromHeader !== 'string' ||
    typeof tokenFromCookie !== 'string' ||
    tokenFromHeader.length === 0 ||
    tokenFromCookie.length === 0
  ) {
    return false;
  }

  // Use timing-safe comparison to prevent timing attacks
  // Both strings must be same length for Buffer.compare
  if (tokenFromHeader.length !== tokenFromCookie.length) {
    return false;
  }

  const bufferFromHeader = Buffer.from(tokenFromHeader);
  const bufferFromCookie = Buffer.from(tokenFromCookie);

  // Buffer.compare returns 0 if equal (timing-safe)
  return bufferFromHeader.compare(bufferFromCookie) === 0;
}

/**
 * CSRF cookie name
 */
export const CSRF_COOKIE_NAME = 'csrf_token';

/**
 * CSRF header name
 */
export const CSRF_HEADER_NAME = 'x-csrf-token';
