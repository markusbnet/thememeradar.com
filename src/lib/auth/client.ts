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
    console.error('Logout failed:', error);
    return false;
  }
}
