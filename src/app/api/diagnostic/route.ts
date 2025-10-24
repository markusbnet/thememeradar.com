import { NextResponse } from 'next/server';
import { docClient } from '@/lib/db/client';
import { QueryCommand } from '@aws-sdk/lib-dynamodb';
import { hashPassword } from '@/lib/auth/password';
import { generateToken } from '@/lib/auth/jwt';

export async function GET() {
  const diagnostics: any = {
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
    tests: {} as any,
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
    diagnostics.tests.dynamoDBQuery = {
      success: true,
      itemCount: result.Items?.length || 0,
    };
  } catch (error: any) {
    diagnostics.tests.dynamoDBQuery = {
      success: false,
      error: error.message,
      code: error.code,
      name: error.name,
    };
  }

  // Test 2: Try bcrypt password hashing
  try {
    const hash = await hashPassword('TestPassword123!');
    diagnostics.tests.bcryptHash = {
      success: true,
      hashLength: hash.length,
    };
  } catch (error: any) {
    diagnostics.tests.bcryptHash = {
      success: false,
      error: error.message,
      name: error.name,
    };
  }

  // Test 3: Try JWT token generation
  try {
    const token = generateToken('test-user-id-123');
    diagnostics.tests.jwtGeneration = {
      success: true,
      tokenLength: token.length,
    };
  } catch (error: any) {
    diagnostics.tests.jwtGeneration = {
      success: false,
      error: error.message,
      name: error.name,
    };
  }

  return NextResponse.json(diagnostics, { status: 200 });
}
