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
  // Let network errors propagate — callers distinguish abort/error (no redirect)
  // from server 4xx (redirect to login).
  const response = await fetch('/api/auth/me', {
    method: 'GET',
    credentials: 'include',
  });

  if (response.ok) {
    const data = await response.json();
    return { authenticated: true, user: data.user };
  }

  return { authenticated: false };
}

/**
 * Logout the current user
 */
export async function logout(): Promise<boolean> {
  try {
    const response = await fetch('/api/auth/logout', {
      method: 'POST',
      credentials: 'include',
    });

    return response.ok;
  } catch (error) {
    return false;
  }
}
