import { NextRequest, NextResponse } from 'next/server';
import { hashPassword, validatePassword } from '@/lib/auth/password';
import { generateToken } from '@/lib/auth/jwt';
import { validateEmail, sanitizeInput } from '@/lib/auth/validation';
import { createUser } from '@/lib/db/users';

export async function POST(request: NextRequest) {
  const steps: { step: string; status: string; data?: unknown; error?: string }[] = [];

  try {
    steps.push({ step: '1', status: 'Start' });

    const body = await request.json();
    steps.push({ step: '2', status: 'JSON parse' });

    const { email, password } = body;
    steps.push({ step: '3', status: 'Extract fields', data: { hasEmail: !!email, hasPassword: !!password } });

    const sanitizedEmail = sanitizeInput(email).toLowerCase();
    steps.push({ step: '4', status: 'Sanitize email' });

    const isValidEmail = validateEmail(sanitizedEmail);
    steps.push({ step: '5', status: 'Validate email', data: { isValid: isValidEmail } });

    const passwordValidation = validatePassword(password);
    steps.push({ step: '6', status: 'Validate password', data: { isValid: passwordValidation.valid } });

    const passwordHash = await hashPassword(password);
    steps.push({ step: '7', status: 'Hash password' });

    const user = await createUser({
      email: sanitizedEmail,
      passwordHash,
    });
    steps.push({ step: '8', status: 'Create user', data: { userId: user.userId } });

    const token = generateToken(user.userId);
    steps.push({ step: '9', status: 'Generate token' });

    return NextResponse.json({ success: true, steps }, { status: 200 });
  } catch (error: unknown) {
    steps.push({
      step: String(steps.length + 1),
      status: 'ERROR',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return NextResponse.json({ success: false, steps }, { status: 500 });
  }
}
