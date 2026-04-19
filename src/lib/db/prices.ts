/**
 * DynamoDB storage for Finnhub price snapshots.
 * Table: stock_prices — PK: ticker, SK: timestamp (ms)
 * TTL: 7 days (attribute name: ttl)
 */

import { docClient, TABLES, PutCommand, QueryCommand } from './client';
import type { StockPriceSnapshot } from '@/types/market';

const TABLE_NAME = TABLES.STOCK_PRICES;

function computeStaleness(fetchedAt: number): StockPriceSnapshot['staleness'] {
  const age = Date.now() - fetchedAt;
  if (age < 15 * 60 * 1000) return 'fresh';
  if (age < 60 * 60 * 1000) return 'normal';
  if (age < 24 * 60 * 60 * 1000) return 'grey';
  return 'drop';
}

export async function savePrice(snapshot: StockPriceSnapshot): Promise<void> {
  await docClient.send(new PutCommand({ TableName: TABLE_NAME, Item: snapshot }));
}

export async function getLatestPrice(ticker: string): Promise<StockPriceSnapshot | null> {
  const result = await docClient.send(
    new QueryCommand({
      TableName: TABLE_NAME,
      KeyConditionExpression: 'ticker = :ticker',
      ExpressionAttributeValues: { ':ticker': ticker },
      ScanIndexForward: false,
      Limit: 1,
    })
  );

  if (!result.Items?.[0]) return null;
  const item = result.Items[0] as StockPriceSnapshot;
  return { ...item, staleness: computeStaleness(item.fetchedAt) };
}

export async function getLatestPriceMap(
  tickers: string[]
): Promise<Map<string, StockPriceSnapshot>> {
  const map = new Map<string, StockPriceSnapshot>();
  await Promise.all(
    tickers.map(async (ticker) => {
      const price = await getLatestPrice(ticker);
      if (price) map.set(ticker, price);
    })
  );
  return map;
}

export async function getPriceHistory(
  ticker: string,
  fromMs: number,
  toMs: number
): Promise<StockPriceSnapshot[]> {
  const result = await docClient.send(
    new QueryCommand({
      TableName: TABLE_NAME,
      KeyConditionExpression: 'ticker = :ticker AND #ts BETWEEN :from AND :to',
      ExpressionAttributeNames: { '#ts': 'timestamp' },
      ExpressionAttributeValues: { ':ticker': ticker, ':from': fromMs, ':to': toMs },
      ScanIndexForward: true,
    })
  );
  return ((result.Items ?? []) as StockPriceSnapshot[]).map((item) => ({
    ...item,
    staleness: computeStaleness(item.fetchedAt),
  }));
}
