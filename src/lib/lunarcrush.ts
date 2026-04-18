/**
 * LunarCrush API v4 HTTP client
 *
 * Requires LUNARCRUSH_API_KEY env var. When the key is absent the client logs
 * a warning and returns null from every method — callers must guard for null.
 *
 * Rate-limit note: the free tier allows 10 req/min. The enrichment pipeline
 * (Task 55) batches and throttles calls to stay well under this ceiling.
 */

import { logger } from '@/lib/logger';
import type {
  LunarCrushStockSummary,
  LunarCrushTopicDetail,
  LunarCrushTimeSeries,
  LunarCrushPost,
} from '@/types/lunarcrush';

const BASE_URL = 'https://lunarcrush.com/api4/public';

export type SortMetric =
  | 'social_dominance'
  | 'galaxy_score'
  | 'volume'
  | 'percent_change_24h'
  | 'alt_rank'
  | 'interactions'
  | 'sentiment';

export type TimeInterval = '1w' | '1m' | '3m' | '6m' | '1y';

export class LunarCrushClient {
  private readonly apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  private async get<T>(path: string): Promise<T> {
    const url = `${BASE_URL}${path}`;
    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        Accept: 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`LunarCrush API error ${response.status}: ${await response.text()}`);
    }

    const json = await response.json() as { data: T };
    return json.data;
  }

  /**
   * Fetch top stocks sorted by a given metric.
   */
  async getStocks(sort: SortMetric = 'social_dominance', limit = 100): Promise<LunarCrushStockSummary[]> {
    return this.get<LunarCrushStockSummary[]>(`/topic/list/stocks/v1?sort=${sort}&limit=${limit}`);
  }

  /**
   * Fetch full social + market profile for a single ticker (e.g. "$GME").
   */
  async getTopic(ticker: string): Promise<LunarCrushTopicDetail> {
    return this.get<LunarCrushTopicDetail>(`/topic/${encodeURIComponent(`$${ticker}`)}/v1`);
  }

  /**
   * Fetch historical time-series metrics for a ticker over the given interval.
   */
  async getTopicTimeSeries(ticker: string, interval: TimeInterval = '1w'): Promise<LunarCrushTimeSeries> {
    const metrics = 'close,volume_24h,sentiment,social_dominance,interactions,posts_active';
    return this.get<LunarCrushTimeSeries>(
      `/topic/${encodeURIComponent(`$${ticker}`)}/time-series/v1?interval=${interval}&metrics=${metrics}`
    );
  }

  /**
   * Fetch top social posts mentioning a ticker across all networks.
   */
  async getTopicPosts(ticker: string, limit = 20): Promise<LunarCrushPost[]> {
    return this.get<LunarCrushPost[]>(
      `/topic/${encodeURIComponent(`$${ticker}`)}/posts/v1?limit=${limit}`
    );
  }
}

/**
 * Singleton factory — returns null and logs a warning when the API key is missing.
 * Use this in production code; use `new LunarCrushClient(key)` in tests.
 */
export function createLunarCrushClient(): LunarCrushClient | null {
  const key = process.env.LUNARCRUSH_API_KEY;
  if (!key) {
    logger.warn('LUNARCRUSH_API_KEY not set — LunarCrush enrichment disabled');
    return null;
  }
  return new LunarCrushClient(key);
}
