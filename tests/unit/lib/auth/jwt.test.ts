import { generateToken, verifyToken } from '@/lib/auth/jwt';
import jwt from 'jsonwebtoken';

describe('JWT Utility', () => {
  const testUserId = 'test-user-123';
  const testSecret = process.env.JWT_SECRET || 'test-secret';

  describe('generateToken', () => {
    it('should generate valid JWT token with userId payload', () => {
      const token = generateToken(testUserId);

      expect(token).toBeDefined();
      expect(typeof token).toBe('string');
      expect(token.split('.')).toHaveLength(3); // JWT format: header.payload.signature
    });

    it('should include userId in token payload', () => {
      const token = generateToken(testUserId);
      const decoded = jwt.decode(token) as { userId: string };

      expect(decoded).toBeDefined();
      expect(decoded.userId).toBe(testUserId);
    });

    it('should set expiration to 7 days', () => {
      const token = generateToken(testUserId);
      const decoded = jwt.decode(token) as { exp: number; iat: number };

      expect(decoded.exp).toBeDefined();
      expect(decoded.iat).toBeDefined();

      const expirationTime = decoded.exp - decoded.iat;
      const sevenDaysInSeconds = 7 * 24 * 60 * 60;

      expect(expirationTime).toBe(sevenDaysInSeconds);
    });

    it('should throw error for empty userId', () => {
      expect(() => generateToken('')).toThrow('userId is required');
    });

    it('should throw error if JWT_SECRET not set', () => {
      const originalSecret = process.env.JWT_SECRET;
      delete process.env.JWT_SECRET;

      expect(() => generateToken(testUserId)).toThrow('JWT_SECRET environment variable is not set');

      process.env.JWT_SECRET = originalSecret;
    });
  });

  describe('verifyToken', () => {
    it('should verify valid JWT token and return payload', () => {
      const token = generateToken(testUserId);
      const payload = verifyToken(token);

      expect(payload).toBeDefined();
      expect(payload?.userId).toBe(testUserId);
    });

    it('should return null for expired JWT token', () => {
      // Create token that expires in 1 second
      const expiredToken = jwt.sign(
        { userId: testUserId },
        testSecret,
        { expiresIn: '1s' }
      );

      // Wait for token to expire
      return new Promise((resolve) => {
        setTimeout(() => {
          const payload = verifyToken(expiredToken);
          expect(payload).toBeNull();
          resolve(undefined);
        }, 1100); // Wait 1.1 seconds
      });
    }, 5000); // Test timeout of 5 seconds

    it('should return null for invalid JWT token (wrong secret)', () => {
      const tokenWithWrongSecret = jwt.sign(
        { userId: testUserId },
        'wrong-secret',
        { expiresIn: '7d' }
      );

      const payload = verifyToken(tokenWithWrongSecret);
      expect(payload).toBeNull();
    });

    it('should return null for malformed JWT token', () => {
      const malformedTokens = [
        'not.a.token',
        'invalid-token',
        '',
        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.invalid',
      ];

      malformedTokens.forEach(token => {
        const payload = verifyToken(token);
        expect(payload).toBeNull();
      });
    });

    it('should return null for token without userId in payload', () => {
      const tokenWithoutUserId = jwt.sign(
        { someOtherField: 'value' },
        testSecret,
        { expiresIn: '7d' }
      );

      const payload = verifyToken(tokenWithoutUserId);
      expect(payload).toBeNull();
    });

    it('should return null if JWT_SECRET not set', () => {
      const originalSecret = process.env.JWT_SECRET;
      delete process.env.JWT_SECRET;

      const token = 'some.token.here';
      const payload = verifyToken(token);

      expect(payload).toBeNull();

      process.env.JWT_SECRET = originalSecret;
    });
  });
});
