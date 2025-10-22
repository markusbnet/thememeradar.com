import { hashPassword, verifyPassword, validatePassword } from '@/lib/auth/password';

describe('Password Utility', () => {
  describe('hashPassword', () => {
    it('should hash password with bcrypt', async () => {
      const password = 'TestPassword123!';
      const hash = await hashPassword(password);

      expect(hash).toBeDefined();
      expect(hash).not.toBe(password);
      expect(hash).toMatch(/^\$2[aby]\$/); // Bcrypt hash format
    });

    it('should return different hash for same password (salting)', async () => {
      const password = 'TestPassword123!';
      const hash1 = await hashPassword(password);
      const hash2 = await hashPassword(password);

      expect(hash1).not.toBe(hash2); // Different salts = different hashes
    });

    it('should throw error for passwords shorter than 8 characters', async () => {
      const weakPassword = 'short';

      await expect(hashPassword(weakPassword)).rejects.toThrow(
        'Password must be at least 8 characters long'
      );
    });
  });

  describe('verifyPassword', () => {
    it('should verify correct password against hash', async () => {
      const password = 'TestPassword123!';
      const hash = await hashPassword(password);

      const isValid = await verifyPassword(password, hash);
      expect(isValid).toBe(true);
    });

    it('should reject incorrect password', async () => {
      const password = 'TestPassword123!';
      const hash = await hashPassword(password);

      const isValid = await verifyPassword('WrongPassword123!', hash);
      expect(isValid).toBe(false);
    });

    it('should reject empty password', async () => {
      const password = 'TestPassword123!';
      const hash = await hashPassword(password);

      const isValid = await verifyPassword('', hash);
      expect(isValid).toBe(false);
    });
  });

  describe('validatePassword', () => {
    it('should accept valid password with all requirements', () => {
      const result = validatePassword('ValidPass123!');

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject password shorter than 8 characters', () => {
      const result = validatePassword('Short1!');

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Password must be at least 8 characters long');
    });

    it('should reject password without uppercase letter', () => {
      const result = validatePassword('lowercase123!');

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Password must contain at least one uppercase letter');
    });

    it('should reject password without lowercase letter', () => {
      const result = validatePassword('UPPERCASE123!');

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Password must contain at least one lowercase letter');
    });

    it('should reject password without number', () => {
      const result = validatePassword('NoNumbers!');

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Password must contain at least one number');
    });

    it('should reject password without special character', () => {
      const result = validatePassword('NoSpecial123');

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Password must contain at least one special character');
    });

    it('should return multiple errors for weak password', () => {
      const result = validatePassword('weak');

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(1);
    });

    it('should accept password with various special characters', () => {
      const passwords = [
        'ValidPass123!',
        'ValidPass123@',
        'ValidPass123#',
        'ValidPass123$',
        'ValidPass123%',
        'ValidPass123^',
        'ValidPass123&',
        'ValidPass123*',
      ];

      passwords.forEach(password => {
        const result = validatePassword(password);
        expect(result.valid).toBe(true);
      });
    });
  });
});
