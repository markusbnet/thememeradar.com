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

const client = new DynamoDBClient({
  region: process.env.AWS_REGION || 'us-east-1',
  endpoint: process.env.DYNAMODB_ENDPOINT || 'http://localhost:8080',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || 'local',
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || 'local',
  },
});

const TABLES = {
  USERS: 'users',
  STOCK_MENTIONS: 'stock_mentions',
  STOCK_EVIDENCE: 'stock_evidence',
  SCAN_HISTORY: 'scan_history',
};

async function deleteTableIfExists(tableName: string) {
  try {
    const listResult = await client.send(new ListTablesCommand({}));
    if (listResult.TableNames?.includes(tableName)) {
      console.log(`Deleting existing table: ${tableName}...`);
      await client.send(new DeleteTableCommand({ TableName: tableName }));
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  } catch (error: any) {
    console.error(`Error checking/deleting table ${tableName}:`, error.message);
  }
}

async function createUsersTable() {
  const tableName = TABLES.USERS;
  await deleteTableIfExists(tableName);

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
  await deleteTableIfExists(tableName);

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
  await deleteTableIfExists(tableName);

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

async function createScanHistoryTable() {
  const tableName = TABLES.SCAN_HISTORY;
  await deleteTableIfExists(tableName);

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

async function main() {
  console.log('=== Initializing DynamoDB Tables ===\n');

  try {
    await createUsersTable();
    await createStockMentionsTable();
    await createStockEvidenceTable();
    await createScanHistoryTable();

    console.log('\n✓ All tables created successfully!');
    console.log('\nTables:');
    console.log('- users (stores user accounts)');
    console.log('- stock_mentions (stores aggregated ticker mentions)');
    console.log('- stock_evidence (stores sample posts/comments for each ticker)');
    console.log('- scan_history (stores scan metadata)');
  } catch (error: any) {
    console.error('\n✗ Error creating tables:', error.message);
    process.exit(1);
  }
}

main();
