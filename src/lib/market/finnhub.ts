/**
 * Finnhub API client for stock price data.
 *
 * Rate-limit math (per spec):
 * Top 50 tickers × 1 price fetch = 50 calls per refresh cycle
 * Refresh every 15 min = 4/hr = 200 calls/hr = 4,800/day
 * Well under Finnhub's free-tier 60 calls/min limit.
 */

import { logger } from '@/lib/logger';
import type { StockPriceSnapshot, FinnhubQuote, FinnhubCandle } from '@/types/market';
import { getLatestPriceMap, savePrice } from '@/lib/db/prices';

const BASE_URL = 'https://finnhub.io/api/v1';
const FIFTEEN_MINUTES = 15 * 60 * 1000;

export function classifyStaleness(fetchedAt: number): StockPriceSnapshot['staleness'] {
  const age = Date.now() - fetchedAt;
  if (age < FIFTEEN_MINUTES) return 'fresh';
  if (age < 60 * 60 * 1000) return 'normal';
  if (age < 24 * 60 * 60 * 1000) return 'grey';
  return 'drop';
}

export class FinnhubClient {
  private readonly apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  private async get<T>(path: string): Promise<T> {
    const sep = path.includes('?') ? '&' : '?';
    const url = `${BASE_URL}${path}${sep}token=${this.apiKey}`;
    const response = await fetch(url);
    if (response.status === 429) {
      throw new Error('Finnhub rate limit exceeded');
    }
    if (!response.ok) {
      throw new Error(`Finnhub API error ${response.status}`);
    }
    return response.json() as Promise<T>;
  }

  async getQuote(ticker: string): Promise<StockPriceSnapshot> {
    const raw = await this.get<FinnhubQuote>(`/quote?symbol=${ticker}`);
    const now = Date.now();
    return {
      ticker,
      timestamp: now,
      price: raw.c,
      changePct24h: raw.dp,
      volume: 0,
      dayHigh: raw.h,
      dayLow: raw.l,
      dayOpen: raw.o,
      previousClose: raw.pc,
      staleness: 'fresh',
      fetchedAt: now,
      ttl: Math.floor(now / 1000) + 7 * 24 * 60 * 60,
    };
  }

  async getCandles(ticker: string, from: number, to: number): Promise<FinnhubCandle> {
    return this.get<FinnhubCandle>(
      `/stock/candle?symbol=${ticker}&resolution=D&from=${from}&to=${to}`
    );
  }
}

export async function enrichWithPrices(tickers: string[]): Promise<void> {
  const apiKey = process.env.FINNHUB_API_KEY;
  if (!apiKey) {
    logger.warn('[Finnhub] FINNHUB_API_KEY not set — skipping price enrichment');
    return;
  }

  const client = new FinnhubClient(apiKey);
  const priceMap = await getLatestPriceMap(tickers);

  for (const ticker of tickers) {
    const existing = priceMap.get(ticker);
    if (existing && classifyStaleness(existing.fetchedAt) === 'fresh') {
      continue;
    }

    try {
      const snapshot = await client.getQuote(ticker);
      await savePrice(snapshot);
    } catch (error: unknown) {
      if (error instanceof Error && error.message.includes('rate limit')) {
        logger.warn('[Finnhub] Rate limit hit — stopping price enrichment');
        break;
      }
      logger.error(
        `[Finnhub] Error fetching price for ${ticker}:`,
        error instanceof Error ? error.message : error
      );
    }
  }
}
