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

    it('should produce unique salts: both hashes must be valid bcrypt and differ from each other', async () => {
      const password = 'TestPassword123!';
      const hash1 = await hashPassword(password);
      const hash2 = await hashPassword(password);

      // Both must be valid bcrypt format
      expect(hash1).toMatch(/^\$2[aby]\$\d{2}\$/);
      expect(hash2).toMatch(/^\$2[aby]\$\d{2}\$/);
      // The salt portion (chars 7-28) must differ, proving unique salts were used
      const salt1 = hash1.substring(7, 29);
      const salt2 = hash2.substring(7, 29);
      expect(salt1).not.toBe(salt2);
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

    describe('specific error messages per failure type', () => {
      it('returns the exact too-short error message', () => {
        // 7 chars, has upper/lower/digit/special — only length fails
        const result = validatePassword('Abc1!gh');
        expect(result.valid).toBe(false);
        expect(result.errors).toEqual(
          expect.arrayContaining(['Password must be at least 8 characters long'])
        );
        expect(result.errors).not.toContain('Password must contain at least one uppercase letter');
        expect(result.errors).not.toContain('Password must contain at least one lowercase letter');
        expect(result.errors).not.toContain('Password must contain at least one number');
        expect(result.errors).not.toContain('Password must contain at least one special character');
      });

      it('returns the exact no-uppercase error message', () => {
        // Has lower, digit, special, length ≥ 8 — only uppercase fails
        const result = validatePassword('lowercase1!');
        expect(result.valid).toBe(false);
        expect(result.errors).toEqual(['Password must contain at least one uppercase letter']);
      });

      it('returns the exact no-lowercase error message', () => {
        // Has upper, digit, special, length ≥ 8 — only lowercase fails
        const result = validatePassword('UPPERCASE1!');
        expect(result.valid).toBe(false);
        expect(result.errors).toEqual(['Password must contain at least one lowercase letter']);
      });

      it('returns the exact no-digit error message', () => {
        // Has upper, lower, special, length ≥ 8 — only digit fails
        const result = validatePassword('NoDigits!A');
        expect(result.valid).toBe(false);
        expect(result.errors).toEqual(['Password must contain at least one number']);
      });

      it('returns the exact no-special-character error message', () => {
        // Has upper, lower, digit, length ≥ 8 — only special char fails
        const result = validatePassword('NoSpecial1A');
        expect(result.valid).toBe(false);
        expect(result.errors).toEqual(['Password must contain at least one special character']);
      });

      it('returns exactly one error when only one rule is violated', () => {
        // Each password below violates exactly one rule
        const cases: [string, string][] = [
          ['Abc1!gh',    'Password must be at least 8 characters long'],
          ['lowercase1!', 'Password must contain at least one uppercase letter'],
          ['UPPERCASE1!', 'Password must contain at least one lowercase letter'],
          ['NoDigits!A',  'Password must contain at least one number'],
          ['NoSpecial1A', 'Password must contain at least one special character'],
        ];

        cases.forEach(([password, expectedError]) => {
          const result = validatePassword(password);
          expect(result.errors).toHaveLength(1);
          expect(result.errors[0]).toBe(expectedError);
        });
      });
    });
  });
});
