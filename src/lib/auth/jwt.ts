import jwt from 'jsonwebtoken';

const JWT_EXPIRATION = '7d';

export interface JWTPayload {
  userId: string;
}

/**
 * Generates a JWT token for a user
 * @param userId - User ID to encode in token
 * @returns JWT token string
 * @throws Error if userId is empty or JWT_SECRET not set
 */
export function generateToken(userId: string): string {
  if (!userId) {
    throw new Error('userId is required');
  }

  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('JWT_SECRET environment variable is not set');
  }

  const payload = { userId: userId };
  const token = jwt.sign(
    payload,
    secret,
    { expiresIn: JWT_EXPIRATION }
  );

  return token;
}

/**
 * Verifies a JWT token and returns payload
 * @param token - JWT token string to verify
 * @returns JWTPayload if valid, null if invalid/expired
 */
export function verifyToken(token: string): JWTPayload | null {
  if (!token) {
    return null;
  }

  const secret = process.env.JWT_SECRET;
  if (!secret) {
    return null;
  }

  try {
    const decoded = jwt.verify(token, secret) as JWTPayload;

    // Ensure userId exists in payload
    if (!decoded.userId) {
      return null;
    }

    return decoded;
  } catch (error) {
    // Token is invalid, expired, or malformed
    return null;
  }
}
