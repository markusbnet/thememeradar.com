/**
 * Initialize DynamoDB Tables
 * Run this script to create tables in DynamoDB Local
 * Usage: npx tsx scripts/init-db.ts
 */

import {
  DynamoDBClient,
  CreateTableCommand,
  ListTablesCommand,
  DeleteTableCommand,
} from '@aws-sdk/client-dynamodb';

// Idempotent by default: existing tables are skipped so this can safely run
// on every `npm run dev`. Pass --reset to drop and recreate everything.
const RESET = process.argv.includes('--reset');
let existingTables: Set<string> = new Set();

// Fail fast if required env vars are missing. No silent defaults for the
// endpoint — a wrong default is how port 8000 vs 8080 drift happens.
const requiredEnv = [
  'DYNAMODB_ENDPOINT',
  'AWS_REGION',
  'AWS_ACCESS_KEY_ID',
  'AWS_SECRET_ACCESS_KEY',
];
const missing = requiredEnv.filter((k) => !process.env[k]);
if (missing.length > 0) {
  console.error(
    `\n✗ Missing required environment variables: ${missing.join(', ')}\n\n` +
      `This script loads .env.local via tsx --env-file. Make sure that file ` +
      `exists at the repo root and defines every variable listed above.\n\n` +
      `If you're running the script directly (not via 'npm run db:init'), ` +
      `either export the variables or use: tsx --env-file=.env.local scripts/init-db.ts\n`
  );
  process.exit(1);
}

const endpoint = process.env.DYNAMODB_ENDPOINT!;
const region = process.env.AWS_REGION!;

console.log(`Using DynamoDB endpoint: ${endpoint} (region: ${region})`);

const client = new DynamoDBClient({
  region,
  endpoint,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

const TABLES = {
  USERS: 'users',
  STOCK_MENTIONS: 'stock_mentions',
  STOCK_EVIDENCE: 'stock_evidence',
  STOCK_ENRICHMENT: 'stock_enrichment',
  OPPORTUNITY_SIGNALS: 'opportunity_signals',
  STOCK_PRICES: 'stock_prices',
  APEWISDOM_SNAPSHOT: 'apewisdom_snapshot',
  EMAIL_ALERTS: 'email_alerts',
  STOCK_OPTIONS: 'stock_options',
};

async function prepareTable(tableName: string): Promise<boolean> {
  // Returns true if the caller should proceed to create the table, false if
  // it already exists and should be skipped. In --reset mode, drops first.
  const exists = existingTables.has(tableName);
  if (exists && RESET) {
    console.log(`Deleting existing table: ${tableName}...`);
    await client.send(new DeleteTableCommand({ TableName: tableName }));
    await new Promise((resolve) => setTimeout(resolve, 1000));
    return true;
  }
  if (exists) {
    console.log(`✓ Table already exists: ${tableName} (skipped)`);
    return false;
  }
  return true;
}

async function createUsersTable() {
  const tableName = TABLES.USERS;
  if (!(await prepareTable(tableName))) return;

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

  console.log(`✓ Created table: ${tableName}`);
}

async function createStockMentionsTable() {
  const tableName = TABLES.STOCK_MENTIONS;
  if (!(await prepareTable(tableName))) return;

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

  console.log(`✓ Created table: ${tableName}`);
}

async function createStockEvidenceTable() {
  const tableName = TABLES.STOCK_EVIDENCE;
  if (!(await prepareTable(tableName))) return;

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
      ProvisionedThroughput: {
        ReadCapacityUnits: 5,
        WriteCapacityUnits: 5,
      },
    })
  );

  console.log(`✓ Created table: ${tableName}`);
}

async function createStockEnrichmentTable() {
  const tableName = TABLES.STOCK_ENRICHMENT;
  if (!(await prepareTable(tableName))) return;

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
      // TTL (on 'ttl' attribute) must be enabled via UpdateTimeToLiveCommand after table creation.
    })
  );

  console.log(`✓ Created table: ${tableName}`);
}

async function createOpportunitySignalsTable() {
  const tableName = TABLES.OPPORTUNITY_SIGNALS;
  if (!(await prepareTable(tableName))) return;

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
      // TTL (on 'ttl' attribute) must be enabled via UpdateTimeToLiveCommand after table creation.
    })
  );

  console.log(`✓ Created table: ${tableName}`);
}

async function createStockPricesTable() {
  const tableName = TABLES.STOCK_PRICES;
  if (!(await prepareTable(tableName))) return;

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
      // TTL (on 'ttl' attribute) must be enabled via UpdateTimeToLiveCommand after table creation.
    })
  );

  console.log(`✓ Created table: ${tableName}`);
}

async function createApewisdomSnapshotTable() {
  const tableName = TABLES.APEWISDOM_SNAPSHOT;
  if (!(await prepareTable(tableName))) return;

  console.log(`Creating table: ${tableName}...`);

  await client.send(
    new CreateTableCommand({
      TableName: tableName,
      KeySchema: [
        { AttributeName: 'subreddit', KeyType: 'HASH' },
        { AttributeName: 'fetchedAt', KeyType: 'RANGE' },
      ],
      AttributeDefinitions: [
        { AttributeName: 'subreddit', AttributeType: 'S' },
        { AttributeName: 'fetchedAt', AttributeType: 'N' },
      ],
      BillingMode: 'PAY_PER_REQUEST',
      // TTL (on 'ttl' attribute) must be enabled via UpdateTimeToLiveCommand after table creation.
    })
  );

  console.log(`✓ Created table: ${tableName}`);
}

async function createEmailAlertsTable() {
  const tableName = TABLES.EMAIL_ALERTS;
  if (!(await prepareTable(tableName))) return;

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

  console.log(`✓ Created table: ${tableName}`);
}

async function createStockOptionsTable() {
  const tableName = TABLES.STOCK_OPTIONS;
  if (!(await prepareTable(tableName))) return;

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
      // TTL (on 'ttl' attribute) must be enabled via UpdateTimeToLiveCommand after table creation.
    })
  );

  console.log(`✓ Created table: ${tableName}`);
}

async function main() {
  console.log(
    `=== Initializing DynamoDB Tables ===${RESET ? ' (--reset: dropping existing)' : ''}\n`
  );

  try {
    const listResult = await client.send(new ListTablesCommand({}));
    existingTables = new Set(listResult.TableNames ?? []);

    await createUsersTable();
    await createStockMentionsTable();
    await createStockEvidenceTable();
    await createStockEnrichmentTable();
    await createOpportunitySignalsTable();
    await createStockPricesTable();
    await createApewisdomSnapshotTable();
    await createEmailAlertsTable();
    await createStockOptionsTable();

    console.log('\n✓ All tables created successfully!');
    console.log('\nTables:');
    console.log('- users (stores user accounts)');
    console.log('- stock_mentions (stores aggregated ticker mentions)');
    console.log('- stock_evidence (stores sample posts/comments for each ticker)');
    console.log('- stock_enrichment (LunarCrush social + price data per ticker, TTL 30d)');
    console.log('- opportunity_signals (composite opportunity scores, TTL 30d)');
    console.log('- stock_prices (Finnhub price snapshots per ticker, TTL 7d)');
    console.log('- apewisdom_snapshot (ApeWisdom ranked ticker lists per subreddit, TTL 48h)');
    console.log('- email_alerts (hot opportunity email alerts, TTL 24h)');
    console.log('- stock_options (SwaggyStocks options OI + IV per ticker, TTL 30d)');
  } catch (error: any) {
    // AWS SDK connection errors (DynamoDB Local down) arrive as AggregateError
    // with an empty top-level message — inspect nested errors for something useful.
    const details: string[] = [];
    if (error?.name) details.push(`name=${error.name}`);
    if (error?.code) details.push(`code=${error.code}`);
    if (error?.$metadata?.httpStatusCode)
      details.push(`httpStatus=${error.$metadata.httpStatusCode}`);
    if (Array.isArray(error?.errors) && error.errors.length > 0) {
      const inner = error.errors
        .map((e: any) => e?.code || e?.message || String(e))
        .filter(Boolean)
        .join(', ');
      if (inner) details.push(`inner=[${inner}]`);
    }

    console.error('\n✗ Error creating tables');
    console.error(`  endpoint: ${endpoint}`);
    console.error(`  message:  ${error?.message || '(empty)'}`);
    if (details.length > 0) console.error(`  details:  ${details.join(' ')}`);

    const isConnRefused =
      error?.name === 'AggregateError' ||
      /ECONNREFUSED|internalConnectMultiple/i.test(error?.stack || '');
    if (isConnRefused) {
      console.error(
        `\n  Cannot reach DynamoDB at ${endpoint}. Is DynamoDB Local running?\n` +
          `  Start it with: docker run -d --name dynamodb-local -p 8000:8000 amazon/dynamodb-local`
      );
    }

    process.exit(1);
  }
}

main();
