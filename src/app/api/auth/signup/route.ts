import { NextRequest, NextResponse } from 'next/server';
import { hashPassword, validatePassword } from '@/lib/auth/password';
import { generateToken } from '@/lib/auth/jwt';
import { validateEmail, sanitizeInput } from '@/lib/auth/validation';
import { createUser } from '@/lib/db/users';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, password } = body;

    // Validate required fields
    if (!email) {
      return NextResponse.json(
        { success: false, error: 'Email is required' },
        { status: 400 }
      );
    }

    if (!password) {
      return NextResponse.json(
        { success: false, error: 'Password is required' },
        { status: 400 }
      );
    }

    // Sanitize and validate email
    const sanitizedEmail = sanitizeInput(email).toLowerCase();
    if (!validateEmail(sanitizedEmail)) {
      return NextResponse.json(
        { success: false, error: 'Invalid email format' },
        { status: 400 }
      );
    }

    // Validate password
    const passwordValidation = validatePassword(password);
    if (!passwordValidation.valid) {
      return NextResponse.json(
        { success: false, error: passwordValidation.errors[0] },
        { status: 400 }
      );
    }

    // Hash password
    const passwordHash = await hashPassword(password);

    // Create user in database
    let user;
    try {
      user = await createUser({
        email: sanitizedEmail,
        passwordHash,
      });
    } catch (error: any) {
      if (error.message === 'Email already registered') {
        return NextResponse.json(
          { success: false, error: 'Email already registered' },
          { status: 409 }
        );
      }
      throw error;
    }

    // Generate JWT token
    const token = generateToken(user.userId);

    // Create response with user data (excluding passwordHash)
    const userData = {
      userId: user.userId,
      email: user.email,
      createdAt: user.createdAt,
    };

    const response = NextResponse.json(
      {
        success: true,
        data: {
          user: userData,
          token,
        },
      },
      { status: 201 }
    );

    // Set httpOnly cookie with JWT token
    const cookieName = process.env.SESSION_COOKIE_NAME || 'meme_radar_session';
    const expirationDays = parseInt(process.env.SESSION_EXPIRATION_DAYS || '7');
    const maxAge = expirationDays * 24 * 60 * 60; // Convert days to seconds

    response.cookies.set(cookieName, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge,
      path: '/',
    });

    return response;
  } catch (error) {
    console.error('Signup error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
