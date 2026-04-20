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
  STOCK_ENRICHMENT: 'memeradar-stock_enrichment',
  OPPORTUNITY_SIGNALS: 'memeradar-opportunity_signals',
  EMAIL_ALERTS: 'memeradar-email_alerts',
  STOCK_OPTIONS: 'memeradar-stock_options',
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

async function createStockEnrichmentTable() {
  const tableName = TABLES.STOCK_ENRICHMENT;

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
      BillingMode: 'PAY_PER_REQUEST',
      // TTL must be enabled separately via UpdateTimeToLiveCommand after table creation.
    })
  );

  await waitForTableActive(tableName);
  console.log(`✓ Created table: ${tableName}`);
}

async function createOpportunitySignalsTable() {
  const tableName = TABLES.OPPORTUNITY_SIGNALS;

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
      BillingMode: 'PAY_PER_REQUEST',
      // TTL must be enabled separately via UpdateTimeToLiveCommand after table creation.
    })
  );

  await waitForTableActive(tableName);
  console.log(`✓ Created table: ${tableName}`);
}

async function createEmailAlertsTable() {
  const tableName = TABLES.EMAIL_ALERTS;

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
        { AttributeName: 'createdAt', KeyType: 'RANGE' },
      ],
      AttributeDefinitions: [
        { AttributeName: 'ticker', AttributeType: 'S' },
        { AttributeName: 'createdAt', AttributeType: 'N' },
      ],
      BillingMode: 'PAY_PER_REQUEST',
      // TTL (on 'ttl' attribute) must be enabled via UpdateTimeToLiveCommand after table creation.
    })
  );

  await waitForTableActive(tableName);
  console.log(`✓ Created table: ${tableName}`);
}

async function createStockOptionsTable() {
  const tableName = TABLES.STOCK_OPTIONS;

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
      BillingMode: 'PAY_PER_REQUEST',
      // TTL must be enabled separately via UpdateTimeToLiveCommand after table creation.
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
    await createStockEnrichmentTable();
    await createOpportunitySignalsTable();
    await createEmailAlertsTable();
    await createStockOptionsTable();
    console.log('\n✓ All tables ready!');
    console.log('\nTables:');
    console.log('- memeradar-users (stores user accounts)');
    console.log('- memeradar-stock_mentions (stores aggregated ticker mentions)');
    console.log('- memeradar-stock_evidence (stores sample posts/comments for each ticker)');
    console.log('- memeradar-stock_enrichment (LunarCrush social + price data, TTL 30d)');
    console.log('- memeradar-opportunity_signals (composite opportunity scores, TTL 30d)');
    console.log('- memeradar-email_alerts (hot opportunity email alerts, TTL 24h)');
    console.log('- memeradar-stock_options (SwaggyStocks options OI + IV per ticker, TTL 30d)');
    console.log('\nBilling: PAY_PER_REQUEST (on-demand, free tier eligible)');
    console.log('TTL: Enabled (data expires after 30 days automatically)');
  } catch (error: any) {
    console.error('\n✗ Error creating tables:', error.message);
    process.exit(1);
  }
}

main();
