import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  QueryCommand,
  UpdateCommand,
  DeleteCommand,
} from '@aws-sdk/lib-dynamodb';

// Configuration from environment
const DYNAMODB_ENDPOINT = process.env.DYNAMODB_ENDPOINT;
const useLocalDb = !!DYNAMODB_ENDPOINT; // Use local if endpoint is explicitly set

// Initialize DynamoDB client
const client = new DynamoDBClient({
  region: process.env.AWS_REGION || 'us-east-1',
  endpoint: useLocalDb ? DYNAMODB_ENDPOINT : undefined,
  credentials: useLocalDb
    ? {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID || 'local',
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || 'local',
      }
    : undefined,
});

// Create DynamoDB Document client for easier JSON handling
export const docClient = DynamoDBDocumentClient.from(client, {
  marshallOptions: {
    removeUndefinedValues: true,
    convertEmptyValues: false,
  },
});

// Export commands for easy access
export { GetCommand, PutCommand, QueryCommand, UpdateCommand, DeleteCommand };
