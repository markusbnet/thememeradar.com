/**
 * SwaggyStocks options data reader.
 *
 * Reads options activity (call/put OI, IV) from the stock_options DynamoDB table.
 * Data is written by the Cowork Chrome automation via POST /api/internal/options-enrichment.
 * No HTTP calls to SwaggyStocks are made from this module.
 */

import { docClient, TABLES, QueryCommand } from '@/lib/db/client';
import type { OptionsActivity } from '@/types/options';

export async function getLatestOptionsActivity(ticker: string): Promise<OptionsActivity | null> {
  const result = await docClient.send(
    new QueryCommand({
      TableName: TABLES.STOCK_OPTIONS,
      KeyConditionExpression: 'ticker = :ticker',
      ExpressionAttributeValues: { ':ticker': ticker },
      ScanIndexForward: false,
      Limit: 1,
    })
  );
  return (result.Items?.[0] as OptionsActivity) ?? null;
}

export async function getOptionsMap(tickers: string[]): Promise<Map<string, OptionsActivity>> {
  const map = new Map<string, OptionsActivity>();
  await Promise.all(
    tickers.map(async (ticker) => {
      const activity = await getLatestOptionsActivity(ticker);
      if (activity) map.set(ticker, activity);
    })
  );
  return map;
}
