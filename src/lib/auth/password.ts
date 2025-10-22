import bcrypt from 'bcrypt';

const BCRYPT_ROUNDS = 10;

export interface PasswordValidationResult {
  valid: boolean;
  errors: string[];
}

/**
 * Validates password against security requirements
 */
export function validatePassword(password: string): PasswordValidationResult {
  const errors: string[] = [];

  if (password.length < 8) {
    errors.push('Password must be at least 8 characters long');
  }

  if (!/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter');
  }

  if (!/[a-z]/.test(password)) {
    errors.push('Password must contain at least one lowercase letter');
  }

  if (!/[0-9]/.test(password)) {
    errors.push('Password must contain at least one number');
  }

  if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
    errors.push('Password must contain at least one special character');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Hashes a password using bcrypt
 * @param password - Plain text password to hash
 * @returns Promise<string> - Hashed password
 * @throws Error if password doesn't meet requirements
 */
export async function hashPassword(password: string): Promise<string> {
  // Validate password before hashing
  const validation = validatePassword(password);
  if (!validation.valid) {
    throw new Error(validation.errors[0]); // Throw first error
  }

  const hash = await bcrypt.hash(password, BCRYPT_ROUNDS);
  return hash;
}

/**
 * Verifies a password against a hash
 * @param password - Plain text password to verify
 * @param hash - Bcrypt hash to verify against
 * @returns Promise<boolean> - True if password matches hash
 */
export async function verifyPassword(
  password: string,
  hash: string
): Promise<boolean> {
  if (!password || !hash) {
    return false;
  }

  try {
    const isValid = await bcrypt.compare(password, hash);
    return isValid;
  } catch (error) {
    // Handle invalid hash format
    return false;
  }
}
