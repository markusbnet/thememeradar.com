/**
 * Validates email format using regex
 * @param email - Email string to validate
 * @returns boolean - True if valid email format
 */
export function validateEmail(email: string): boolean {
  if (!email || typeof email !== 'string') {
    return false;
  }

  // RFC 5322 compliant email regex (simplified)
  // Requires: local@domain.tld format
  const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;

  const trimmed = email.trim();

  // Additional checks for invalid patterns
  if (trimmed.includes('..') || trimmed.includes(' ')) {
    return false;
  }

  return emailRegex.test(trimmed);
}

/**
 * Sanitizes user input to prevent XSS attacks
 * @param input - User input string to sanitize
 * @returns string - Sanitized input
 */
export function sanitizeInput(input: string): string {
  if (!input || typeof input !== 'string') {
    return '';
  }

  // Trim whitespace
  const trimmed = input.trim();

  // Escape HTML special characters
  const escaped = trimmed
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');

  return escaped;
}
