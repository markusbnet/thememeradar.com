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
    accessKeyId: 'test',
    secretAccessKey: 'test',
  },
});

const USERS_TABLE = 'meme-radar-users';

async function deleteTableIfExists(tableName: string) {
  try {
    const listResult = await client.send(new ListTablesCommand({}));
    if (listResult.TableNames?.includes(tableName)) {
      console.log(`Deleting existing table: ${tableName}...`);
      await client.send(new DeleteTableCommand({ TableName: tableName }));
      console.log(`Table ${tableName} deleted.`);
      // Wait a bit for deletion to complete
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  } catch (error) {
    console.error(`Error deleting table ${tableName}:`, error);
  }
}

async function createUsersTable() {
  await deleteTableIfExists(USERS_TABLE);

  console.log(`Creating table: ${USERS_TABLE}...`);

  await client.send(
    new CreateTableCommand({
      TableName: USERS_TABLE,
      KeySchema: [{ AttributeName: 'userId', KeyType: 'HASH' }],
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

  console.log(`✅ Table ${USERS_TABLE} created successfully!`);
}

async function initDatabase() {
  console.log('🚀 Initializing DynamoDB tables...\n');

  try {
    await createUsersTable();
    console.log('\n✅ All tables created successfully!');
  } catch (error) {
    console.error('\n❌ Error initializing database:', error);
    process.exit(1);
  }
}

initDatabase();
