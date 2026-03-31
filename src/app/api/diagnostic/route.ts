import { NextResponse } from 'next/server';
import { docClient } from '@/lib/db/client';
import { QueryCommand } from '@aws-sdk/lib-dynamodb';
import { hashPassword } from '@/lib/auth/password';
import { generateToken } from '@/lib/auth/jwt';

export async function GET() {
  const diagnostics: Record<string, unknown> = {
    timestamp: new Date().toISOString(),
    environment: {
      NODE_ENV: process.env.NODE_ENV,
      hasAccessKey: !!process.env.AWS_ACCESS_KEY_ID,
      accessKeyLength: process.env.AWS_ACCESS_KEY_ID?.length,
      accessKeyPrefix: process.env.AWS_ACCESS_KEY_ID?.substring(0, 4),
      hasSecretKey: !!process.env.AWS_SECRET_ACCESS_KEY,
      secretKeyLength: process.env.AWS_SECRET_ACCESS_KEY?.length,
      region: process.env.AWS_REGION,
      tableName: process.env.USERS_TABLE_NAME,
      hasDynamoDBEndpoint: !!process.env.DYNAMODB_ENDPOINT,
      hasJWTSecret: !!process.env.JWT_SECRET,
      jwtSecretLength: process.env.JWT_SECRET?.length,
    },
    tests: {} as Record<string, unknown>,
  };

  // Test 1: Try to query the users table
  try {
    const result = await docClient.send(
      new QueryCommand({
        TableName: process.env.USERS_TABLE_NAME || 'users',
        IndexName: 'email-index',
        KeyConditionExpression: 'email = :email',
        ExpressionAttributeValues: {
          ':email': 'nonexistent@test.com',
        },
        Limit: 1,
      })
    );
    (diagnostics.tests as Record<string, unknown>).dynamoDBQuery = {
      success: true,
      itemCount: result.Items?.length || 0,
    };
  } catch (error: unknown) {
    (diagnostics.tests as Record<string, unknown>).dynamoDBQuery = {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      code: (error as Record<string, unknown>).code,
      name: error instanceof Error ? error.name : 'Unknown',
    };
  }

  // Test 2: Try bcrypt password hashing
  try {
    const hash = await hashPassword('TestPassword123!');
    (diagnostics.tests as Record<string, unknown>).bcryptHash = {
      success: true,
      hashLength: hash.length,
    };
  } catch (error: unknown) {
    (diagnostics.tests as Record<string, unknown>).bcryptHash = {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      name: error instanceof Error ? error.name : 'Unknown',
    };
  }

  // Test 3: Try JWT token generation
  try {
    const token = generateToken('test-user-id-123');
    (diagnostics.tests as Record<string, unknown>).jwtGeneration = {
      success: true,
      tokenLength: token.length,
    };
  } catch (error: unknown) {
    (diagnostics.tests as Record<string, unknown>).jwtGeneration = {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      name: error instanceof Error ? error.name : 'Unknown',
    };
  }

  return NextResponse.json(diagnostics, { status: 200 });
}
