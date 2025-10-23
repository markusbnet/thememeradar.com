/**
 * DynamoDB Client Configuration
 * Handles connection to DynamoDB (local or production)
 */

import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient,
  PutCommand,
  GetCommand,
  QueryCommand,
  ScanCommand,
  BatchWriteCommand,
} from '@aws-sdk/lib-dynamodb';

// Configuration from environment
const DYNAMODB_ENDPOINT = process.env.DYNAMODB_ENDPOINT;
const useLocalDb = !!DYNAMODB_ENDPOINT; // Use local if endpoint is explicitly set

// Create DynamoDB client
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

// Create Document client for easier data handling
export const docClient = DynamoDBDocumentClient.from(client, {
  marshallOptions: {
    removeUndefinedValues: true,
    convertEmptyValues: false,
  },
});

// Table names
export const TABLES = {
  STOCK_MENTIONS: 'stock_mentions',
  STOCK_EVIDENCE: 'stock_evidence',
  SCAN_HISTORY: 'scan_history',
};

// Export command constructors for use in other modules
export { PutCommand, GetCommand, QueryCommand, ScanCommand, BatchWriteCommand };
