import { NextRequest, NextResponse } from 'next/server';
import { deleteUserByEmail } from '@/lib/db/users';

/**
 * DELETE /api/test/delete-user
 * Deletes a user by email (for test cleanup only)
 * This endpoint should only be available in non-production environments
 */
export async function DELETE(request: NextRequest) {
  // Only allow in non-production environments
  if (process.env.NODE_ENV === 'production' && !process.env.ALLOW_TEST_ENDPOINTS) {
    return NextResponse.json(
      { success: false, error: 'Not allowed in production' },
      { status: 403 }
    );
  }

  try {
    const body = await request.json();
    const { email } = body;

    if (!email) {
      return NextResponse.json(
        { success: false, error: 'Email is required' },
        { status: 400 }
      );
    }

    await deleteUserByEmail(email);

    return NextResponse.json(
      { success: true, message: 'User deleted successfully' },
      { status: 200 }
    );
  } catch (error) {
    console.error('Delete user error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
