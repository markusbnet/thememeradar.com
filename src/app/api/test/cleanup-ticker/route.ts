import { NextRequest, NextResponse } from 'next/server';
import { docClient, TABLES, QueryCommand, BatchWriteCommand } from '@/lib/db/client';

function guardTestEndpoint() {
  if (process.env.NODE_ENV === 'production' && !process.env.ALLOW_TEST_ENDPOINTS) {
    return NextResponse.json({ success: false, error: 'Not allowed' }, { status: 403 });
  }
  return null;
}

export async function DELETE(request: NextRequest) {
  const guard = guardTestEndpoint();
  if (guard) return guard;

  const { ticker } = await request.json();
  if (!ticker) {
    return NextResponse.json({ success: false, error: 'ticker required' }, { status: 400 });
  }

  const mentionsResult = await docClient.send(new QueryCommand({
    TableName: TABLES.STOCK_MENTIONS,
    KeyConditionExpression: 'ticker = :t',
    ExpressionAttributeValues: { ':t': ticker },
    ProjectionExpression: 'ticker, #ts',
    ExpressionAttributeNames: { '#ts': 'timestamp' },
  }));

  const mentionItems = mentionsResult.Items ?? [];
  for (let i = 0; i < mentionItems.length; i += 25) {
    const chunk = mentionItems.slice(i, i + 25);
    await docClient.send(new BatchWriteCommand({
      RequestItems: {
        [TABLES.STOCK_MENTIONS]: chunk.map(item => ({
          DeleteRequest: { Key: { ticker: item.ticker, timestamp: item.timestamp } },
        })),
      },
    }));
  }

  const evidenceResult = await docClient.send(new QueryCommand({
    TableName: TABLES.STOCK_EVIDENCE,
    KeyConditionExpression: 'ticker = :t',
    ExpressionAttributeValues: { ':t': ticker },
    ProjectionExpression: 'ticker, evidenceId',
  }));

  const evidenceItems = evidenceResult.Items ?? [];
  for (let i = 0; i < evidenceItems.length; i += 25) {
    const chunk = evidenceItems.slice(i, i + 25);
    await docClient.send(new BatchWriteCommand({
      RequestItems: {
        [TABLES.STOCK_EVIDENCE]: chunk.map(item => ({
          DeleteRequest: { Key: { ticker: item.ticker, evidenceId: item.evidenceId } },
        })),
      },
    }));
  }

  return NextResponse.json({
    success: true,
    ticker,
    deleted: { mentions: mentionItems.length, evidence: evidenceItems.length },
  });
}
