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
 *
 * ALGORITHM: Surge score calculation
 * ───────────────────────────────────
 * 1. If currentMentions < minAbsoluteMentions (default: 10), return null (not enough signal)
 * 2. If baselineAvg is 0 (brand new stock), return score = 1.0 (maximum surge)
 * 3. multiplier = currentMentions / baselineAvg
 * 4. If multiplier < surgeMultiplier (default: 3x), return null (not surging enough)
 * 5. score = 1 - 1/(1 + ln(multiplier)/ln(surgeMultiplier))
 *    → This is a log-scale normalization: 3x ≈ 0.5, 9x ≈ 0.75, 27x ≈ 0.875
 *    → Score is always between 0 and 1, asymptotically approaching 1
 *
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
 *
 * ALGORITHM: Multi-window baseline comparison
 * ────────────────────────────────────────────
 * 1. Get all stock mentions from the CURRENT 15-minute bucket
 * 2. For each stock, query the PRIOR 4 buckets (1 hour of history)
 * 3. baselineAvg = total baseline mentions / 4 (always divides by 4, even if
 *    some buckets are missing — this treats missing data as 0 mentions)
 * 4. Run computeSurgeScore(current, baselineAvg, config)
 * 5. Build sparkline: [baseline_1, baseline_2, baseline_3, baseline_4, current]
 * 6. Sort results by surgeScore descending, return top N
 *
 * The surge detection is SEPARATE from the trending algorithm:
 * - Trending: current vs previous (2 buckets, any positive change)
 * - Surge: current vs 1-hour average (5 buckets, >= 3x spike required)
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
