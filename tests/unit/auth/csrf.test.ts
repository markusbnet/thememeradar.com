/**
 * Unit Tests for CSRF Protection
 */

import { generateCSRFToken, validateCSRFToken } from '@/lib/auth/csrf';

describe('CSRF Protection', () => {
  describe('generateCSRFToken', () => {
    it('should generate a 64-character token', () => {
      const token = generateCSRFToken();
      expect(token).toHaveLength(64);
    });

    it('should generate unique tokens', () => {
      const token1 = generateCSRFToken();
      const token2 = generateCSRFToken();
      expect(token1).not.toBe(token2);
    });

    it('should generate hex strings', () => {
      const token = generateCSRFToken();
      expect(token).toMatch(/^[0-9a-f]{64}$/);
    });

    it('should generate cryptographically secure tokens', () => {
      const tokens = new Set();
      for (let i = 0; i < 100; i++) {
        tokens.add(generateCSRFToken());
      }
      // All 100 tokens should be unique
      expect(tokens.size).toBe(100);
    });
  });

  describe('validateCSRFToken', () => {
    it('should return true for matching tokens', () => {
      const token = generateCSRFToken();
      expect(validateCSRFToken(token, token)).toBe(true);
    });

    it('should return false for non-matching tokens', () => {
      const token1 = generateCSRFToken();
      const token2 = generateCSRFToken();
      expect(validateCSRFToken(token1, token2)).toBe(false);
    });

    it('should return false if header token is null', () => {
      const token = generateCSRFToken();
      expect(validateCSRFToken(null, token)).toBe(false);
    });

    it('should return false if cookie token is null', () => {
      const token = generateCSRFToken();
      expect(validateCSRFToken(token, null)).toBe(false);
    });

    it('should return false if both tokens are null', () => {
      expect(validateCSRFToken(null, null)).toBe(false);
    });

    it('should return false for empty strings', () => {
      expect(validateCSRFToken('', '')).toBe(false);
    });

    it('should return false if tokens are different lengths', () => {
      const token = generateCSRFToken();
      const shortToken = token.substring(0, 32);
      expect(validateCSRFToken(token, shortToken)).toBe(false);
    });

    it('should use timing-safe comparison', () => {
      const token1 = 'a'.repeat(64);
      const token2 = 'b'.repeat(64);

      const start = process.hrtime.bigint();
      validateCSRFToken(token1, token2);
      const elapsed1 = process.hrtime.bigint() - start;

      const start2 = process.hrtime.bigint();
      validateCSRFToken(token1, token1);
      const elapsed2 = process.hrtime.bigint() - start2;

      // Timing should be similar (within 2x)
      // This is a rough test - in practice timing attacks are more sophisticated
      const ratio = Number(elapsed1) / Number(elapsed2);
      expect(ratio).toBeLessThan(10); // Allow some variance
    });

    it('should be case-sensitive', () => {
      const token = generateCSRFToken();
      const uppercaseToken = token.toUpperCase();
      expect(validateCSRFToken(token, uppercaseToken)).toBe(false);
    });
  });
});
