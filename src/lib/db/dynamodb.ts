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
const isDevelopment = process.env.NODE_ENV === 'development';
const DYNAMODB_ENDPOINT = process.env.DYNAMODB_ENDPOINT || 'http://localhost:8080';

// Create DynamoDB client
const client = new DynamoDBClient({
  region: process.env.AWS_REGION || 'us-east-1',
  endpoint: isDevelopment ? DYNAMODB_ENDPOINT : undefined,
  credentials: isDevelopment
    ? {
        accessKeyId: 'local',
        secretAccessKey: 'local',
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
