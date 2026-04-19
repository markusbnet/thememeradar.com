/**
 * ApeWisdom coverage layer tests — parser + merge logic
 */

import { parseApewisdomPayload, mergeCoverage } from '@/lib/coverage/apewisdom';
import type { ApewisdomIngestPayload, ApewisdomSnapshot } from '@/types/apewisdom';
import type { TrendingStock } from '@/lib/db/storage';
import fixture from '../../../fixtures/apewisdom-wsb-sample.json';

const NOW = 1745094000000; // matches fixture fetchedAt

function makeTrendingStock(ticker: string, overrides: Partial<TrendingStock> = {}): TrendingStock {
  return {
    ticker,
    mentionCount: 100,
    sentimentScore: 0.5,
    sentimentCategory: 'bullish',
    velocity: 50,
    timestamp: NOW,
    rankDelta24h: null,
    rankStatus: 'unknown',
    ...overrides,
  };
}

describe('parseApewisdomPayload', () => {
  it('parses a valid payload from the fixture', () => {
    const payload: ApewisdomIngestPayload = {
      subreddit: fixture.subreddit,
      rows: fixture.rows as any,
      fetchedAt: fixture.fetchedAt,
    };
    const snapshot = parseApewisdomPayload(payload);
    expect(snapshot.subreddit).toBe('wallstreetbets');
    expect(snapshot.rows).toHaveLength(12);
    expect(snapshot.rows[0].ticker).toBe('GME');
    expect(snapshot.rows[2].rank_24h_ago).toBeNull();
  });

  it('throws when subreddit is missing', () => {
    expect(() => parseApewisdomPayload({ subreddit: '', rows: [], fetchedAt: NOW }))
      .toThrow(/subreddit/i);
  });

  it('throws when fetchedAt is not a number', () => {
    expect(() => parseApewisdomPayload({ subreddit: 'wsb', rows: [], fetchedAt: NaN }))
      .toThrow(/fetchedAt/i);
  });

  it('throws when a row is missing required fields', () => {
    const badRow = { rank: 1, ticker: 'GME', mentions: 100 }; // missing mentions_24h_ago, upvotes
    expect(() =>
      parseApewisdomPayload({ subreddit: 'wsb', rows: [badRow as any], fetchedAt: NOW })
    ).toThrow(/row/i);
  });
});

describe('mergeCoverage', () => {
  const freshSnapshot: ApewisdomSnapshot = {
    subreddit: 'wallstreetbets',
    fetchedAt: NOW - 30 * 60 * 1000, // 30 min ago (fresh)
    rows: fixture.rows as any,
    ttl: NOW + 48 * 3600,
  };

  it('returns reddit-only when snapshot is null', () => {
    const stocks = [makeTrendingStock('GME'), makeTrendingStock('TSLA')];
    const result = mergeCoverage(stocks, null, NOW);
    expect(result.every(s => s.coverageSource === 'reddit')).toBe(true);
    expect(result).toHaveLength(2);
  });

  it('returns reddit-only when snapshot is stale (> 3 hours old)', () => {
    const staleSnapshot: ApewisdomSnapshot = {
      ...freshSnapshot,
      fetchedAt: NOW - 4 * 60 * 60 * 1000, // 4 hours ago
    };
    const stocks = [makeTrendingStock('GME')];
    const result = mergeCoverage(stocks, staleSnapshot, NOW);
    expect(result[0].coverageSource).toBe('reddit');
    expect(result).toHaveLength(1);
  });

  it('marks tickers in both sources as both', () => {
    const stocks = [makeTrendingStock('GME')];
    const result = mergeCoverage(stocks, freshSnapshot, NOW);
    const gme = result.find(s => s.ticker === 'GME');
    expect(gme?.coverageSource).toBe('both');
  });

  it('marks tickers only in reddit as reddit', () => {
    const stocks = [makeTrendingStock('FAKECOIN')]; // not in fixture
    const result = mergeCoverage(stocks, freshSnapshot, NOW);
    const fakecoin = result.find(s => s.ticker === 'FAKECOIN');
    expect(fakecoin?.coverageSource).toBe('reddit');
  });

  it('includes apewisdom-only tickers as apewisdom', () => {
    const stocks = [makeTrendingStock('FAKECOIN')];
    const result = mergeCoverage(stocks, freshSnapshot, NOW);
    const bird = result.find(s => s.ticker === 'BIRD');
    expect(bird).toBeDefined();
    expect(bird?.coverageSource).toBe('apewisdom');
    expect(bird?.mentionCount).toBe(310);
  });

  it('uses our mentionCount and sentimentScore when both sources have data', () => {
    const stocks = [makeTrendingStock('GME', { mentionCount: 900, sentimentScore: 0.8 })];
    const result = mergeCoverage(stocks, freshSnapshot, NOW);
    const gme = result.find(s => s.ticker === 'GME');
    expect(gme?.mentionCount).toBe(900); // ours wins
    expect(gme?.sentimentScore).toBe(0.8);
  });

  it('fills rankDelta24h from apewisdom when ours is null', () => {
    const stocks = [makeTrendingStock('GME', { rankDelta24h: null })];
    const result = mergeCoverage(stocks, freshSnapshot, NOW);
    const gme = result.find(s => s.ticker === 'GME');
    // fixture: GME rank=1, rank_24h_ago=3 → delta = 3 - 1 = +2 (climbed)
    expect(gme?.rankDelta24h).toBe(2);
  });

  it('keeps our rankDelta24h when it is not null', () => {
    const stocks = [makeTrendingStock('GME', { rankDelta24h: 5 })];
    const result = mergeCoverage(stocks, freshSnapshot, NOW);
    const gme = result.find(s => s.ticker === 'GME');
    expect(gme?.rankDelta24h).toBe(5); // ours preserved
  });

  it('does not produce duplicate tickers', () => {
    const stocks = [makeTrendingStock('GME'), makeTrendingStock('TSLA')];
    const result = mergeCoverage(stocks, freshSnapshot, NOW);
    const tickers = result.map(s => s.ticker);
    const unique = new Set(tickers);
    expect(unique.size).toBe(tickers.length);
  });

  it('sorts reddit/both before apewisdom-only within same velocity range', () => {
    // SOFI apewisdom velocity: (140/80 - 1)*100 = 75%; give GME velocity=74 (within 5%)
    // Both sources, GME should rank before SOFI ('apewisdom-only') despite equal velocity
    const stocks = [makeTrendingStock('GME', { velocity: 74 })];
    const result = mergeCoverage(stocks, freshSnapshot, NOW);
    const gmeIdx = result.findIndex(s => s.ticker === 'GME');
    const sofiIdx = result.findIndex(s => s.ticker === 'SOFI');
    expect(gmeIdx).toBeLessThan(sofiIdx);
  });

  it('computes velocity for apewisdom-only tickers from mentions ratio', () => {
    const stocks: TrendingStock[] = [];
    const result = mergeCoverage(stocks, freshSnapshot, NOW);
    // BIRD: mentions=310, mentions_24h_ago=0 → velocity = 0
    const bird = result.find(s => s.ticker === 'BIRD');
    expect(typeof bird?.velocity).toBe('number');
    // GME: 450/200 - 1 = 1.25 = 125%
    const gme = result.find(s => s.ticker === 'GME');
    expect(gme?.velocity).toBeCloseTo(125, 0);
  });

  it('handles apewisdom rows with null rank_24h_ago', () => {
    const stocks: TrendingStock[] = [];
    const result = mergeCoverage(stocks, freshSnapshot, NOW);
    const bird = result.find(s => s.ticker === 'BIRD');
    expect(bird?.rankDelta24h).toBeNull();
  });
});
