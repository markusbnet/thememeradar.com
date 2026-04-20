/**
 * Integration tests for /api/health. Exercises the real DynamoDB Local
 * (no mocks) so that a broken pipeline here will fail the test, matching
 * what users see at runtime. Each test asserts against the shape the
 * dashboard + CI rely on — status, subsystem flags, freshness.
 */

// Tests use real DynamoDB Local but don't rely on the user's .env.local — set
// the minimum env explicitly so behavior is the same locally and in CI.
process.env.DYNAMODB_ENDPOINT =
  process.env.DYNAMODB_ENDPOINT || 'http://localhost:8000';
process.env.AWS_REGION = process.env.AWS_REGION || 'us-east-1';
process.env.AWS_ACCESS_KEY_ID = process.env.AWS_ACCESS_KEY_ID || 'test';
process.env.AWS_SECRET_ACCESS_KEY = process.env.AWS_SECRET_ACCESS_KEY || 'test';
process.env.CRON_SECRET = process.env.CRON_SECRET || 'test-cron-secret';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret';
process.env.REDDIT_CLIENT_ID = process.env.REDDIT_CLIENT_ID || 'test-client-id';
process.env.REDDIT_CLIENT_SECRET =
  process.env.REDDIT_CLIENT_SECRET || 'test-client-secret';

import { GET } from '@/app/api/health/route';
import { docClient, PutCommand, DeleteCommand, TABLES } from '@/lib/db/client';
import {
  DynamoDBClient,
  CreateTableCommand,
  DeleteTableCommand,
  ListTablesCommand,
} from '@aws-sdk/client-dynamodb';
import { ScanCommand } from '@aws-sdk/lib-dynamodb';

// Dedicated control-plane client so we can drop/recreate tables for the
// "missing table" failure case without tripping the doc client's cache.
const controlClient = new DynamoDBClient({
  region: process.env.AWS_REGION || 'us-east-1',
  endpoint: process.env.DYNAMODB_ENDPOINT,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || 'test',
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || 'test',
  },
});

async function clearStockMentions() {
  // The health endpoint reads stock_mentions for freshness. Clearing between
  // tests isolates each assertion; we scan-and-delete rather than drop the
  // table so the "tables present" assertion stays green in other tests.
  const res = await docClient.send(
    new ScanCommand({ TableName: TABLES.STOCK_MENTIONS })
  );
  for (const item of res.Items || []) {
    await docClient.send(
      new DeleteCommand({
        TableName: TABLES.STOCK_MENTIONS,
        Key: { ticker: item.ticker, timestamp: item.timestamp },
      })
    );
  }
}

async function seedRecentMention(ticker = 'TEST', timestamp = Date.now()) {
  await docClient.send(
    new PutCommand({
      TableName: TABLES.STOCK_MENTIONS,
      Item: {
        ticker,
        timestamp,
        mentionCount: 5,
        sentimentScore: 0.3,
        bullishCount: 3,
        bearishCount: 1,
        neutralCount: 1,
        upvoteScore: 10,
        uniquePosts: 2,
        uniqueComments: 3,
        subredditBreakdown: { wallstreetbets: 5 },
        topKeywords: ['moon'],
      },
    })
  );
}

describe('GET /api/health (real DynamoDB)', () => {
  beforeEach(async () => {
    await clearStockMentions();
  });

  it('returns 200 and status=ok when DB, tables, and env are healthy', async () => {
    await seedRecentMention();
    const response = await GET(new Request('http://localhost:3000/api/health'));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data.status).toBe('ok');
    expect(body.data.subsystems.db.ok).toBe(true);
    expect(body.data.subsystems.tables.ok).toBe(true);
    expect(body.data.subsystems.env.ok).toBe(true);
  });

  it('reports lastScan=null and status=degraded when stock_mentions is empty', async () => {
    const response = await GET(new Request('http://localhost:3000/api/health'));
    const body = await response.json();

    expect(body.data.subsystems.scan.lastScanAt).toBeNull();
    expect(body.data.subsystems.scan.recentMentions).toBe(0);
    expect(body.data.status).toBe('degraded');
  });

  it('reports lastScan timestamp and recent count after a scan', async () => {
    const now = Date.now();
    await seedRecentMention('AAA', now - 1000);
    await seedRecentMention('BBB', now - 500);

    const response = await GET(new Request('http://localhost:3000/api/health'));
    const body = await response.json();

    expect(body.data.subsystems.scan.lastScanAt).toBeGreaterThan(0);
    expect(body.data.subsystems.scan.recentMentions).toBeGreaterThanOrEqual(2);
  });

  it('reports env subsystem flags for required vars', async () => {
    const response = await GET(new Request('http://localhost:3000/api/health'));
    const body = await response.json();

    // We don't log the values — just whether they are set. This matches what
    // a fresh-clone user needs to diagnose "why isn't X working."
    expect(body.data.subsystems.env.required).toEqual(
      expect.objectContaining({
        CRON_SECRET: expect.any(Boolean),
        JWT_SECRET: expect.any(Boolean),
        REDDIT_CLIENT_ID: expect.any(Boolean),
      })
    );
  });

  it('returns 503 when a required table is missing', async () => {
    // Drop stock_mentions, then hit health. Recreate after so other tests
    // (and predev) are unaffected. This is the only destructive test — keep
    // it late in the file so ordering is obvious.
    const existing = await controlClient.send(new ListTablesCommand({}));
    const hadTable = existing.TableNames?.includes(TABLES.STOCK_MENTIONS);
    if (hadTable) {
      await controlClient.send(
        new DeleteTableCommand({ TableName: TABLES.STOCK_MENTIONS })
      );
      await new Promise((r) => setTimeout(r, 500));
    }

    try {
      const response = await GET(
        new Request('http://localhost:3000/api/health')
      );
      const body = await response.json();

      expect(response.status).toBe(503);
      expect(body.data.subsystems.tables.ok).toBe(false);
      expect(body.data.subsystems.tables.missing).toContain(
        TABLES.STOCK_MENTIONS
      );
    } finally {
      if (hadTable) {
        // Re-create with the full schema that init-db.ts uses, including
        // the timestamp-index GSI that /api/stocks/trending relies on.
        // Mismatched schemas here silently break downstream endpoints.
        await controlClient.send(
          new CreateTableCommand({
            TableName: TABLES.STOCK_MENTIONS,
            KeySchema: [
              { AttributeName: 'ticker', KeyType: 'HASH' },
              { AttributeName: 'timestamp', KeyType: 'RANGE' },
            ],
            AttributeDefinitions: [
              { AttributeName: 'ticker', AttributeType: 'S' },
              { AttributeName: 'timestamp', AttributeType: 'N' },
            ],
            GlobalSecondaryIndexes: [
              {
                IndexName: 'timestamp-index',
                KeySchema: [
                  { AttributeName: 'timestamp', KeyType: 'HASH' },
                ],
                Projection: { ProjectionType: 'ALL' },
                ProvisionedThroughput: {
                  ReadCapacityUnits: 5,
                  WriteCapacityUnits: 5,
                },
              },
            ],
            ProvisionedThroughput: {
              ReadCapacityUnits: 5,
              WriteCapacityUnits: 5,
            },
          })
        );
        await new Promise((r) => setTimeout(r, 500));
      }
    }
  });
});
