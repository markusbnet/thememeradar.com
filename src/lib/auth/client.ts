/**
 * Client-side authentication utilities
 */

export interface User {
  userId: string;
  email: string;
  createdAt: number;
  lastLoginAt?: number;
}

/**
 * Check if user is authenticated by verifying session
 * This makes a request to the server to validate the session cookie
 */
export async function checkAuth(): Promise<{ authenticated: boolean; user?: User }> {
  try {
    const response = await fetch('/api/auth/me', {
      method: 'GET',
      credentials: 'include', // Include cookies
    });

    if (response.ok) {
      const data = await response.json();
      return {
        authenticated: true,
        user: data.user,
      };
    }

    return { authenticated: false };
  } catch (error) {
    console.error('Auth check failed:', error);
    return { authenticated: false };
  }
}

/**
 * Read the CSRF token from the csrf_token cookie (set with httpOnly: false).
 * Returns undefined in non-browser environments (SSR).
 */
function getCsrfToken(): string | undefined {
  if (typeof document === 'undefined') return undefined;
  return document.cookie
    .split('; ')
    .find(row => row.startsWith('csrf_token='))
    ?.split('=')[1];
}

/**
 * Logout the current user
 * Sends the CSRF token from the cookie as a header to pass CSRF validation.
 */
export async function logout(): Promise<boolean> {
  try {
    const csrfToken = getCsrfToken();
    const response = await fetch('/api/auth/logout', {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        ...(csrfToken ? { 'x-csrf-token': csrfToken } : {}),
      },
    });

    return response.ok;
  } catch (error) {
    console.error('Logout failed:', error);
    return false;
  }
}
