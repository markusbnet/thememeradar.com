import { NextRequest, NextResponse } from 'next/server';
import { hashPassword, validatePassword } from '@/lib/auth/password';
import { generateToken } from '@/lib/auth/jwt';
import { validateEmail, sanitizeInput } from '@/lib/auth/validation';
import { createUser } from '@/lib/db/users';

export async function POST(request: NextRequest) {
  const steps: any[] = [];

  try {
    steps.push({ step: 1, name: 'Start', success: true });

    const body = await request.json();
    steps.push({ step: 2, name: 'JSON parse', success: true });

    const { email, password } = body;
    steps.push({ step: 3, name: 'Extract fields', success: true, hasEmail: !!email, hasPassword: !!password });

    const sanitizedEmail = sanitizeInput(email).toLowerCase();
    steps.push({ step: 4, name: 'Sanitize email', success: true });

    const isValidEmail = validateEmail(sanitizedEmail);
    steps.push({ step: 5, name: 'Validate email', success: true, isValid: isValidEmail });

    const passwordValidation = validatePassword(password);
    steps.push({ step: 6, name: 'Validate password', success: true, isValid: passwordValidation.valid });

    const passwordHash = await hashPassword(password);
    steps.push({ step: 7, name: 'Hash password', success: true });

    const user = await createUser({
      email: sanitizedEmail,
      passwordHash,
    });
    steps.push({ step: 8, name: 'Create user', success: true, userId: user.userId });

    const token = generateToken(user.userId);
    steps.push({ step: 9, name: 'Generate token', success: true });

    return NextResponse.json({ success: true, steps }, { status: 200 });
  } catch (error: any) {
    steps.push({
      step: steps.length + 1,
      name: 'ERROR',
      success: false,
      error: error.message,
      errorName: error.name,
      errorStack: error.stack?.substring(0, 500),
    });
    return NextResponse.json({ success: false, steps }, { status: 500 });
  }
}
