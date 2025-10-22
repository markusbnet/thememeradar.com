import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth/jwt';
import { getUserById } from '@/lib/db/users';

export async function GET(request: NextRequest) {
  try {
    // Get token from cookie
    const cookieName = process.env.SESSION_COOKIE_NAME || 'meme_radar_session';
    const token = request.cookies.get(cookieName)?.value;

    if (!token) {
      return NextResponse.json(
        { success: false, error: 'Not authenticated' },
        { status: 401 }
      );
    }

    // Verify token
    const payload = verifyToken(token);
    if (!payload) {
      return NextResponse.json(
        { success: false, error: 'Invalid or expired token' },
        { status: 401 }
      );
    }

    // Get user from database
    const user = await getUserById(payload.userId);
    if (!user) {
      return NextResponse.json(
        { success: false, error: 'User not found' },
        { status: 401 }
      );
    }

    // Return user data (excluding passwordHash)
    const userData = {
      userId: user.userId,
      email: user.email,
      createdAt: user.createdAt,
      lastLoginAt: user.lastLoginAt,
    };

    return NextResponse.json(
      {
        success: true,
        user: userData,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Auth check error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
