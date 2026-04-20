import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  QueryCommand,
  UpdateCommand,
  DeleteCommand,
  ScanCommand,
  BatchWriteCommand,
} from '@aws-sdk/lib-dynamodb';

// Configuration from environment
// Note: Vercel env vars are trimmed automatically, no need to .trim() here
const DYNAMODB_ENDPOINT = process.env.DYNAMODB_ENDPOINT;
const useLocalDb = !!DYNAMODB_ENDPOINT; // Use local if endpoint is explicitly set

// Initialize DynamoDB client
const client = new DynamoDBClient({
  region: process.env.AWS_REGION || 'us-east-1',
  endpoint: useLocalDb ? DYNAMODB_ENDPOINT : undefined,
  // Provide credentials if environment variables are set
  // This works for both local development and production
  credentials:
    process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY
      ? {
          accessKeyId: process.env.AWS_ACCESS_KEY_ID,
          secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
        }
      : undefined, // Falls back to AWS SDK default credential chain
});

// Create DynamoDB Document client for easier JSON handling
export const docClient = DynamoDBDocumentClient.from(client, {
  marshallOptions: {
    removeUndefinedValues: true,
    convertEmptyValues: false,
  },
});

// Table names
const TABLE_PREFIX = useLocalDb ? '' : 'memeradar-';
export const TABLES = {
  STOCK_MENTIONS: `${TABLE_PREFIX}stock_mentions`,
  STOCK_EVIDENCE: `${TABLE_PREFIX}stock_evidence`,
  STOCK_ENRICHMENT: `${TABLE_PREFIX}stock_enrichment`,
  STOCK_PRICES: `${TABLE_PREFIX}stock_prices`,
  APEWISDOM_SNAPSHOT: `${TABLE_PREFIX}apewisdom_snapshot`,
  EMAIL_ALERTS: `${TABLE_PREFIX}email_alerts`,
  STOCK_OPTIONS: `${TABLE_PREFIX}stock_options`,
};

// Export commands for easy access
export { GetCommand, PutCommand, QueryCommand, UpdateCommand, DeleteCommand, ScanCommand, BatchWriteCommand };
