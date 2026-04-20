/**
 * DynamoDB storage layer for email alerts.
 * Table: email_alerts — PK: ticker (String), SK: createdAt (Number, ms timestamp)
 * TTL: 24 hours from creation
 */

import { docClient, TABLES, PutCommand, QueryCommand, UpdateCommand, ScanCommand } from './client';

export interface StoredAlert {
  ticker: string;
  createdAt: number;
  opportunityScore: number;
  subScores: {
    velocity: number;
    sentiment: number;
    socialDominance: number;
    volumeChange: number;
    creatorInfluence: number;
  };
  emailSubject: string;
  emailBody: string;
  sentAt: number | null;
  ttl: number;
}

export async function saveAlert(alert: Omit<StoredAlert, 'ttl'>): Promise<void> {
  const ttl = Math.floor(alert.createdAt / 1000) + 24 * 60 * 60; // 24h TTL
  await docClient.send(
    new PutCommand({
      TableName: TABLES.EMAIL_ALERTS,
      Item: { ...alert, ttl },
    })
  );
}

export async function getPendingAlerts(): Promise<StoredAlert[]> {
  const result = await docClient.send(
    new ScanCommand({
      TableName: TABLES.EMAIL_ALERTS,
      FilterExpression: 'attribute_not_exists(sentAt) OR sentAt = :null',
      ExpressionAttributeValues: { ':null': null },
    })
  );
  return (result.Items || []) as StoredAlert[];
}

export async function markAlertSent(ticker: string, createdAt: number): Promise<boolean> {
  try {
    await docClient.send(
      new UpdateCommand({
        TableName: TABLES.EMAIL_ALERTS,
        Key: { ticker, createdAt },
        UpdateExpression: 'SET sentAt = :now',
        ExpressionAttributeValues: { ':now': Date.now() },
        ConditionExpression: 'attribute_exists(ticker)',
      })
    );
    return true;
  } catch {
    return false;
  }
}

export async function getRecentAlerts(ticker: string, sinceMs: number): Promise<StoredAlert[]> {
  const result = await docClient.send(
    new QueryCommand({
      TableName: TABLES.EMAIL_ALERTS,
      KeyConditionExpression: 'ticker = :ticker AND createdAt > :since',
      ExpressionAttributeValues: { ':ticker': ticker, ':since': sinceMs },
    })
  );
  return (result.Items || []) as StoredAlert[];
}
