/**
 * Surge Detection for Meme Stocks
 * Detects unusual spikes in mention velocity using multi-window baseline comparison.
 * A "surge" = current 15-min mentions >= 3x the average of the prior 4 intervals (1 hour).
 */

import { docClient, TABLES, QueryCommand } from './client';
import { roundToInterval } from './storage';

export interface SurgeConfig {
  minAbsoluteMentions: number; // Minimum mentions in current window to qualify
  surgeMultiplier: number;     // Current must be >= this * baseline to count as surge
}

export const DEFAULT_SURGE_CONFIG: SurgeConfig = {
  minAbsoluteMentions: 10,
  surgeMultiplier: 3,
};

export interface SurgeResult {
  multiplier: number; // current / baseline (Infinity if baseline is 0)
  score: number;      // normalized 0-1 score
}

export interface SurgeStock {
  ticker: string;
  mentionCount: number;
  baselineMentions: number;
  surgeMultiplier: number;
  surgeScore: number;
  sentimentScore: number;
  sentimentCategory: string;
  detectedAt: number;
  sparklineData: number[];
}

/**
 * Pure function: compute whether a stock is surging based on current vs baseline mentions.
 * Returns null if not surging.
 */
export function computeSurgeScore(
  currentMentions: number,
  baselineAvg: number,
  config: SurgeConfig
): SurgeResult | null {
  if (currentMentions < config.minAbsoluteMentions) {
    return null;
  }

  if (baselineAvg === 0) {
    return { multiplier: Infinity, score: 1.0 };
  }

  const multiplier = currentMentions / baselineAvg;

  if (multiplier < config.surgeMultiplier) {
    return null;
  }

  // Normalize: log scale so 3x=~0.5, 9x=~0.75, 27x=~0.875
  const score = 1 - (1 / (1 + Math.log(multiplier) / Math.log(config.surgeMultiplier)));

  return { multiplier, score };
}

/**
 * Query DynamoDB for currently surging stocks.
 * Compares the current 15-min bucket against the average of the prior 4 buckets (1 hour).
 */
export async function getSurgingStocks(
  limit: number = 5,
  config: SurgeConfig = DEFAULT_SURGE_CONFIG
): Promise<SurgeStock[]> {
  const INTERVAL_MS = 15 * 60 * 1000;
  const now = roundToInterval(Date.now());

  // Get all stocks in the current interval
  const currentData = await docClient.send(
    new QueryCommand({
      TableName: TABLES.STOCK_MENTIONS,
      IndexName: 'timestamp-index',
      KeyConditionExpression: '#timestamp = :timestamp',
      ExpressionAttributeNames: { '#timestamp': 'timestamp' },
      ExpressionAttributeValues: { ':timestamp': now },
    })
  );

  const currentItems = currentData.Items || [];
  if (currentItems.length === 0) {
    return [];
  }

  const surging: SurgeStock[] = [];

  for (const item of currentItems) {
    const ticker = item.ticker as string;
    const currentMentions = (item.mentionCount as number) || 0;

    // Query the 4 prior intervals for this ticker
    const baselineStart = now - 4 * INTERVAL_MS;
    const baselineEnd = now - INTERVAL_MS;

    const baselineData = await docClient.send(
      new QueryCommand({
        TableName: TABLES.STOCK_MENTIONS,
        KeyConditionExpression: 'ticker = :ticker AND #ts BETWEEN :start AND :end',
        ExpressionAttributeNames: { '#ts': 'timestamp' },
        ExpressionAttributeValues: {
          ':ticker': ticker,
          ':start': baselineStart,
          ':end': baselineEnd,
        },
      })
    );

    const baselineItems = baselineData.Items || [];
    const baselineTotal = baselineItems.reduce(
      (sum: number, i) => sum + ((i.mentionCount as number) || 0),
      0
    );
    const baselineAvg = baselineItems.length > 0 ? baselineTotal / 4 : 0;

    const result = computeSurgeScore(currentMentions, baselineAvg, config);
    if (result) {
      // Build sparkline from the 5 intervals (4 baseline + current)
      const sparkline = baselineItems
        .sort((a, b) => (a.timestamp as number) - (b.timestamp as number))
        .map((i) => (i.mentionCount as number) || 0);
      sparkline.push(currentMentions);

      surging.push({
        ticker,
        mentionCount: currentMentions,
        baselineMentions: Math.round(baselineAvg * 10) / 10,
        surgeMultiplier: Math.round(result.multiplier * 10) / 10,
        surgeScore: Math.round(result.score * 100) / 100,
        sentimentScore: (item.avgSentimentScore as number) || 0,
        sentimentCategory: (item.sentimentCategory as string) || 'neutral',
        detectedAt: now,
        sparklineData: sparkline,
      });
    }
  }

  // Sort by surge score descending, return top N
  return surging.sort((a, b) => b.surgeScore - a.surgeScore).slice(0, limit);
}
