jest.mock('@/lib/db/storage', () => ({
  getTrendingStocks: jest.fn(),
  getFadingStocks: jest.fn(),
}));

jest.mock('@/lib/db/enrichment', () => ({
  getEnrichmentMap: jest.fn(),
}));

import { GET } from '@/app/api/stocks/opportunities/route';
import { getTrendingStocks, getFadingStocks } from '@/lib/db/storage';
import { getEnrichmentMap } from '@/lib/db/enrichment';
import type { TrendingStock } from '@/lib/db/storage';
import type { StoredEnrichment } from '@/lib/db/enrichment';

const mockGetTrending = getTrendingStocks as jest.MockedFunction<typeof getTrendingStocks>;
const mockGetFading = getFadingStocks as jest.MockedFunction<typeof getFadingStocks>;
const mockGetEnrichmentMap = getEnrichmentMap as jest.MockedFunction<typeof getEnrichmentMap>;

const mockStock = (ticker: string, velocity: number, sentiment: number): TrendingStock => ({
  ticker,
  mentionCount: 100,
  sentimentScore: sentiment,
  sentimentCategory: sentiment > 0.2 ? 'bullish' : 'neutral',
  velocity,
  timestamp: 1700000000000,
});

const mockEnrichment = (ticker: string, pctChange: number): StoredEnrichment => ({
  ticker,
  timestamp: 1700000000000,
  price: 25,
  volume_24h: 1000000,
  percent_change_24h: pctChange,
  social_dominance: 5,
  galaxy_score: 60,
  sentiment: 4,
  engagements: 50000,
  mentions_cross_platform: 200,
  top_creators: [
    { screen_name: 'user1', network: 'twitter', influencer_rank: 10, followers: 500000, posts: 5, engagements: 10000 },
  ],
  engagements_by_network: { twitter: 45000 },
  fetchedAt: 1700000000000,
  ttl: 1702592000,
});

describe('GET /api/stocks/opportunities', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetTrending.mockResolvedValue([]);
    mockGetFading.mockResolvedValue([]);
    mockGetEnrichmentMap.mockResolvedValue(new Map());
  });

  it('returns 200 with success=true', async () => {
    const response = await GET();
    const data = await response.json();
    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
  });

  it('returns an opportunities array', async () => {
    const response = await GET();
    const data = await response.json();
    expect(Array.isArray(data.data.opportunities)).toBe(true);
  });

  it('returns empty opportunities when no stocks', async () => {
    const response = await GET();
    const data = await response.json();
    expect(data.data.opportunities).toHaveLength(0);
  });

  it('each opportunity has required fields', async () => {
    mockGetTrending.mockResolvedValue([mockStock('GME', 400, 0.8)]);
    const enrichMap = new Map([['GME', mockEnrichment('GME', 15)]]);
    mockGetEnrichmentMap.mockResolvedValue(enrichMap);

    const response = await GET();
    const data = await response.json();

    expect(data.data.opportunities.length).toBeGreaterThan(0);
    const opp = data.data.opportunities[0];
    expect(opp).toHaveProperty('ticker');
    expect(opp).toHaveProperty('score');
    expect(opp).toHaveProperty('signalLevel');
    expect(opp).toHaveProperty('subScores');
    expect(opp.subScores).toHaveProperty('velocity');
    expect(opp.subScores).toHaveProperty('sentiment');
    expect(opp.subScores).toHaveProperty('socialDominance');
    expect(opp.subScores).toHaveProperty('volumeChange');
    expect(opp.subScores).toHaveProperty('creatorInfluence');
  });

  it('opportunities are sorted by score descending', async () => {
    mockGetTrending.mockResolvedValue([
      mockStock('LOW', 10, 0.1),
      mockStock('HIGH', 400, 0.9),
      mockStock('MED', 150, 0.5),
    ]);
    const enrichMap = new Map([
      ['LOW', mockEnrichment('LOW', 1)],
      ['HIGH', mockEnrichment('HIGH', 15)],
      ['MED', mockEnrichment('MED', 8)],
    ]);
    mockGetEnrichmentMap.mockResolvedValue(enrichMap);

    const response = await GET();
    const data = await response.json();
    const opps = data.data.opportunities;

    expect(opps.length).toBeGreaterThan(1);
    for (let i = 1; i < opps.length; i++) {
      expect(opps[i - 1].score).toBeGreaterThanOrEqual(opps[i].score);
    }
  });

  it('filters out stocks with score < 30 (none signal level)', async () => {
    // velocity=0, sentiment=-1, no enrichment → score ~0
    mockGetTrending.mockResolvedValue([mockStock('ZERO', 0, -1)]);
    mockGetEnrichmentMap.mockResolvedValue(new Map());

    const response = await GET();
    const data = await response.json();
    expect(data.data.opportunities).toHaveLength(0);
  });

  it('deduplicates tickers that appear in both trending and fading', async () => {
    mockGetTrending.mockResolvedValue([mockStock('GME', 300, 0.8)]);
    mockGetFading.mockResolvedValue([mockStock('GME', -20, 0.8)]);
    mockGetEnrichmentMap.mockResolvedValue(new Map([['GME', mockEnrichment('GME', 10)]]));

    const response = await GET();
    const data = await response.json();
    const tickers = data.data.opportunities.map((o: { ticker: string }) => o.ticker);
    expect(tickers.filter((t: string) => t === 'GME')).toHaveLength(1);
  });

  it('includes scores in 0–100 range', async () => {
    mockGetTrending.mockResolvedValue([mockStock('GME', 400, 0.9)]);
    mockGetEnrichmentMap.mockResolvedValue(new Map([['GME', mockEnrichment('GME', 18)]]));

    const response = await GET();
    const data = await response.json();
    for (const opp of data.data.opportunities) {
      expect(opp.score).toBeGreaterThanOrEqual(0);
      expect(opp.score).toBeLessThanOrEqual(100);
    }
  });

  it('returns 500 when getTrendingStocks throws', async () => {
    mockGetTrending.mockRejectedValueOnce(new Error('DB error'));

    const response = await GET();
    const data = await response.json();
    expect(response.status).toBe(500);
    expect(data.success).toBe(false);
    expect(data.error).toBe('DB error');
  });

  it('returns 500 with fallback message when non-Error thrown', async () => {
    mockGetTrending.mockRejectedValueOnce('network failure');

    const response = await GET();
    const data = await response.json();
    expect(response.status).toBe(500);
    expect(data.success).toBe(false);
    expect(data.error).toBe('Failed to fetch opportunities');
  });
});
