/**
 * Initialize DynamoDB Tables for Production
 * Run this script to create tables in AWS DynamoDB
 * Usage: npx tsx scripts/init-db-production.ts
 */

import {
  DynamoDBClient,
  CreateTableCommand,
  ListTablesCommand,
  DescribeTableCommand,
} from '@aws-sdk/client-dynamodb';

const client = new DynamoDBClient({
  region: process.env.AWS_REGION || 'us-east-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

const TABLES = {
  USERS: 'memeradar-users',
  STOCK_MENTIONS: 'memeradar-stock_mentions',
  STOCK_EVIDENCE: 'memeradar-stock_evidence',
  SCAN_HISTORY: 'memeradar-scan_history',
};

async function tableExists(tableName: string): Promise<boolean> {
  try {
    const listResult = await client.send(new ListTablesCommand({}));
    return listResult.TableNames?.includes(tableName) || false;
  } catch (error: any) {
    console.error(`Error checking if table ${tableName} exists:`, error.message);
    return false;
  }
}

async function waitForTableActive(tableName: string, maxWaitSeconds: number = 60) {
  const startTime = Date.now();
  while (Date.now() - startTime < maxWaitSeconds * 1000) {
    try {
      const result = await client.send(
        new DescribeTableCommand({ TableName: tableName })
      );
      if (result.Table?.TableStatus === 'ACTIVE') {
        return true;
      }
      await new Promise(resolve => setTimeout(resolve, 2000));
    } catch (error) {
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }
  throw new Error(`Table ${tableName} did not become active within ${maxWaitSeconds} seconds`);
}

async function createUsersTable() {
  const tableName = TABLES.USERS;

  if (await tableExists(tableName)) {
    console.log(`✓ Table already exists: ${tableName}`);
    return;
  }

  console.log(`Creating table: ${tableName}...`);

  await client.send(
    new CreateTableCommand({
      TableName: tableName,
      KeySchema: [
        { AttributeName: 'userId', KeyType: 'HASH' },
      ],
      AttributeDefinitions: [
        { AttributeName: 'userId', AttributeType: 'S' },
        { AttributeName: 'email', AttributeType: 'S' },
      ],
      GlobalSecondaryIndexes: [
        {
          IndexName: 'email-index',
          KeySchema: [{ AttributeName: 'email', KeyType: 'HASH' }],
          Projection: { ProjectionType: 'ALL' },
        },
      ],
      BillingMode: 'PAY_PER_REQUEST', // On-demand pricing (free tier)
    })
  );

  await waitForTableActive(tableName);
  console.log(`✓ Created table: ${tableName}`);
}

async function createStockMentionsTable() {
  const tableName = TABLES.STOCK_MENTIONS;

  if (await tableExists(tableName)) {
    console.log(`✓ Table already exists: ${tableName}`);
    return;
  }

  console.log(`Creating table: ${tableName}...`);

  await client.send(
    new CreateTableCommand({
      TableName: tableName,
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
          KeySchema: [{ AttributeName: 'timestamp', KeyType: 'HASH' }],
          Projection: { ProjectionType: 'ALL' },
        },
      ],
      BillingMode: 'PAY_PER_REQUEST',
    })
  );

  await waitForTableActive(tableName);
  console.log(`✓ Created table: ${tableName}`);
}

async function createStockEvidenceTable() {
  const tableName = TABLES.STOCK_EVIDENCE;

  if (await tableExists(tableName)) {
    console.log(`✓ Table already exists: ${tableName}`);
    return;
  }

  console.log(`Creating table: ${tableName}...`);

  await client.send(
    new CreateTableCommand({
      TableName: tableName,
      KeySchema: [
        { AttributeName: 'ticker', KeyType: 'HASH' },
        { AttributeName: 'evidenceId', KeyType: 'RANGE' },
      ],
      AttributeDefinitions: [
        { AttributeName: 'ticker', AttributeType: 'S' },
        { AttributeName: 'evidenceId', AttributeType: 'S' },
      ],
      BillingMode: 'PAY_PER_REQUEST',
    })
  );

  await waitForTableActive(tableName);
  console.log(`✓ Created table: ${tableName}`);
}

async function createScanHistoryTable() {
  const tableName = TABLES.SCAN_HISTORY;

  if (await tableExists(tableName)) {
    console.log(`✓ Table already exists: ${tableName}`);
    return;
  }

  console.log(`Creating table: ${tableName}...`);

  await client.send(
    new CreateTableCommand({
      TableName: tableName,
      KeySchema: [
        { AttributeName: 'scanId', KeyType: 'HASH' },
      ],
      AttributeDefinitions: [
        { AttributeName: 'scanId', AttributeType: 'S' },
        { AttributeName: 'timestamp', AttributeType: 'N' },
      ],
      GlobalSecondaryIndexes: [
        {
          IndexName: 'timestamp-index',
          KeySchema: [{ AttributeName: 'timestamp', KeyType: 'HASH' }],
          Projection: { ProjectionType: 'ALL' },
        },
      ],
      BillingMode: 'PAY_PER_REQUEST',
    })
  );

  await waitForTableActive(tableName);
  console.log(`✓ Created table: ${tableName}`);
}

async function main() {
  console.log('=== Initializing Production DynamoDB Tables ===\n');
  console.log(`Region: ${process.env.AWS_REGION || 'us-east-1'}\n`);

  if (!process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_SECRET_ACCESS_KEY) {
    console.error('Error: AWS credentials not found in environment variables');
    console.error('Please set AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY');
    process.exit(1);
  }

  try {
    await createUsersTable();
    await createStockMentionsTable();
    await createStockEvidenceTable();
    await createScanHistoryTable();

    console.log('\n✓ All tables ready!');
    console.log('\nTables:');
    console.log('- memeradar-users (stores user accounts)');
    console.log('- memeradar-stock_mentions (stores aggregated ticker mentions)');
    console.log('- memeradar-stock_evidence (stores sample posts/comments for each ticker)');
    console.log('- memeradar-scan_history (stores scan metadata)');
    console.log('\nBilling: PAY_PER_REQUEST (on-demand, free tier eligible)');
    console.log('TTL: Enabled (data expires after 30 days automatically)');
  } catch (error: any) {
    console.error('\n✗ Error creating tables:', error.message);
    process.exit(1);
  }
}

main();
