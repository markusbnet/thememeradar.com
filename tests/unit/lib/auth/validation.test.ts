import { validateEmail, sanitizeInput } from '@/lib/auth/validation';

describe('Validation Utility', () => {
  describe('validateEmail', () => {
    it('should accept valid email formats', () => {
      const validEmails = [
        'test@example.com',
        'user.name@example.com',
        'user+tag@example.co.uk',
        'test123@test-domain.com',
        'a@b.co',
      ];

      validEmails.forEach(email => {
        expect(validateEmail(email)).toBe(true);
      });
    });

    it('should reject invalid email formats', () => {
      const invalidEmails = [
        'invalid',
        'invalid@',
        '@example.com',
        'invalid@.com',
        'invalid@domain',
        'invalid @example.com',
        'invalid@domain .com',
        '',
        'test@@example.com',
        'test@example..com',
      ];

      invalidEmails.forEach(email => {
        expect(validateEmail(email)).toBe(false);
      });
    });

    it('should be case-insensitive', () => {
      expect(validateEmail('TEST@EXAMPLE.COM')).toBe(true);
      expect(validateEmail('Test@Example.Com')).toBe(true);
    });

    it('should handle edge cases', () => {
      expect(validateEmail(' ')).toBe(false);
      expect(validateEmail('null')).toBe(false);
      expect(validateEmail('undefined')).toBe(false);
    });
  });

  describe('sanitizeInput', () => {
    it('should remove leading and trailing whitespace', () => {
      expect(sanitizeInput('  test  ')).toBe('test');
      expect(sanitizeInput('\n\ttest\n\t')).toBe('test');
    });

    it('should escape HTML tags (XSS prevention)', () => {
      expect(sanitizeInput('<script>alert("xss")</script>'))
        .toBe('&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;');

      expect(sanitizeInput('<img src=x onerror=alert(1)>'))
        .toBe('&lt;img src=x onerror=alert(1)&gt;');
    });

    it('should escape special HTML characters', () => {
      expect(sanitizeInput('<')).toBe('&lt;');
      expect(sanitizeInput('>')).toBe('&gt;');
      expect(sanitizeInput('"')).toBe('&quot;');
      expect(sanitizeInput("'")).toBe('&#x27;');
      expect(sanitizeInput('&')).toBe('&amp;');
    });

    it('should handle empty strings', () => {
      expect(sanitizeInput('')).toBe('');
      expect(sanitizeInput('   ')).toBe('');
    });

    it('should preserve valid content', () => {
      expect(sanitizeInput('Hello World')).toBe('Hello World');
      expect(sanitizeInput('test@example.com')).toBe('test@example.com');
      expect(sanitizeInput('ValidPass123!')).toBe('ValidPass123!');
    });

    it('should handle null and undefined', () => {
      expect(sanitizeInput(null as any)).toBe('');
      expect(sanitizeInput(undefined as any)).toBe('');
    });
  });
});
