import { v4 as uuidv4 } from 'uuid';
import { docClient, PutCommand, QueryCommand, GetCommand } from './client';

const USERS_TABLE = process.env.USERS_TABLE_NAME || 'meme-radar-users';

export interface User {
  userId: string;
  email: string;
  passwordHash: string;
  createdAt: number;
  lastLoginAt: number;
}

export interface CreateUserInput {
  email: string;
  passwordHash: string;
}

/**
 * Creates a new user in DynamoDB
 * @param input - User creation data
 * @returns Created user object
 * @throws Error if email already exists
 */
export async function createUser(input: CreateUserInput): Promise<User> {
  const { email, passwordHash } = input;

  // Check if email already exists
  const existingUser = await getUserByEmail(email);
  if (existingUser) {
    throw new Error('Email already registered');
  }

  const now = Date.now();
  const user: User = {
    userId: uuidv4(),
    email: email.toLowerCase().trim(),
    passwordHash,
    createdAt: now,
    lastLoginAt: now,
  };

  await docClient.send(
    new PutCommand({
      TableName: USERS_TABLE,
      Item: user,
    })
  );

  return user;
}

/**
 * Gets a user by email (using GSI)
 * @param email - User's email
 * @returns User object or null if not found
 */
export async function getUserByEmail(email: string): Promise<User | null> {
  const normalizedEmail = email.toLowerCase().trim();

  const result = await docClient.send(
    new QueryCommand({
      TableName: USERS_TABLE,
      IndexName: 'email-index',
      KeyConditionExpression: 'email = :email',
      ExpressionAttributeValues: {
        ':email': normalizedEmail,
      },
    })
  );

  if (!result.Items || result.Items.length === 0) {
    return null;
  }

  return result.Items[0] as User;
}

/**
 * Gets a user by userId
 * @param userId - User's ID
 * @returns User object or null if not found
 */
export async function getUserById(userId: string): Promise<User | null> {
  const result = await docClient.send(
    new GetCommand({
      TableName: USERS_TABLE,
      Key: { userId },
    })
  );

  if (!result.Item) {
    return null;
  }

  return result.Item as User;
}

/**
 * Updates user's lastLoginAt timestamp
 * @param userId - User's ID
 */
export async function updateLastLogin(userId: string): Promise<void> {
  await docClient.send(
    new PutCommand({
      TableName: USERS_TABLE,
      Item: {
        userId,
        lastLoginAt: Date.now(),
      },
    })
  );
}
