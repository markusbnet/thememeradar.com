/**
 * DynamoDB storage for ApeWisdom snapshots.
 * Table: apewisdom_snapshot — PK: subreddit, SK: fetchedAt (ms)
 * TTL: 48 hours (attribute name: ttl, stored as Unix seconds)
 */

import { docClient, TABLES, PutCommand, QueryCommand } from './client';
import type { ApewisdomSnapshot } from '@/types/apewisdom';

const TABLE_NAME = TABLES.APEWISDOM_SNAPSHOT;

export async function saveApewisdomSnapshot(snapshot: ApewisdomSnapshot): Promise<void> {
  await docClient.send(new PutCommand({ TableName: TABLE_NAME, Item: snapshot }));
}

export async function getLatestApewisdomSnapshot(
  subreddit: string
): Promise<ApewisdomSnapshot | null> {
  const result = await docClient.send(
    new QueryCommand({
      TableName: TABLE_NAME,
      KeyConditionExpression: 'subreddit = :sub',
      ExpressionAttributeValues: { ':sub': subreddit },
      ScanIndexForward: false,
      Limit: 1,
    })
  );
  return (result.Items?.[0] as ApewisdomSnapshot) ?? null;
}
