import { checkAuth, logout } from '@/lib/auth/client';

// Mock global fetch
const mockFetch = jest.fn();
global.fetch = mockFetch;

describe('auth/client', () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  describe('checkAuth', () => {
    it('should return authenticated true with user data on success', async () => {
      const mockUser = { userId: 'u-1', email: 'test@test.com', createdAt: 1000 };
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ user: mockUser }),
      });

      const result = await checkAuth();

      expect(result.authenticated).toBe(true);
      expect(result.user).toEqual(mockUser);
      expect(mockFetch).toHaveBeenCalledWith('/api/auth/me', {
        method: 'GET',
        credentials: 'include',
      });
    });

    it('should return authenticated false on non-ok response', async () => {
      mockFetch.mockResolvedValueOnce({ ok: false });

      const result = await checkAuth();

      expect(result.authenticated).toBe(false);
      expect(result.user).toBeUndefined();
    });

    it('should throw on network error so callers can distinguish abort from 401', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      await expect(checkAuth()).rejects.toThrow('Network error');
    });
  });

  describe('logout', () => {
    it('should return true on successful logout', async () => {
      mockFetch.mockResolvedValueOnce({ ok: true });

      const result = await logout();

      expect(result).toBe(true);
      expect(mockFetch).toHaveBeenCalledWith('/api/auth/logout', {
        method: 'POST',
        credentials: 'include',
      });
    });

    it('should return false on failed logout', async () => {
      mockFetch.mockResolvedValueOnce({ ok: false });

      const result = await logout();

      expect(result).toBe(false);
    });

    it('should return false on network error', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const result = await logout();

      expect(result).toBe(false);
    });
  });
});
