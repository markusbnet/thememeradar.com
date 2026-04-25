// Mock DB + coverage layer (same pattern as internal trending tests)
jest.mock('@/lib/db/storage', () => ({
  getTrendingStocks: jest.fn(),
  getFadingStocks: jest.fn(),
  getSparklineData: jest.fn(),
}));
jest.mock('@/lib/db/enrichment', () => ({
  getEnrichmentMap: jest.fn().mockResolvedValue(new Map()),
}));
jest.mock('@/lib/db/prices', () => ({
  getLatestPriceMap: jest.fn().mockResolvedValue(new Map()),
}));
jest.mock('@/lib/db/apewisdom', () => ({
  getLatestApewisdomSnapshot: jest.fn().mockResolvedValue(null),
}));
jest.mock('@/lib/coverage/apewisdom', () => jest.requireActual('@/lib/coverage/apewisdom'));

// Mock rate limiter — default to allowed, overridden per-test for 429 case
const mockRateLimiterCheck = jest.fn().mockReturnValue({ allowed: true, remaining: 59 });
jest.mock('@/lib/public-api-rate-limiter', () => ({
  publicRateLimiter: { check: (...args: unknown[]) => mockRateLimiterCheck(...args) },
  getClientIP: jest.fn().mockReturnValue('127.0.0.1'),
}));

import { GET } from '@/app/api/public/v1/stocks/trending/route';
import { getTrendingStocks, getFadingStocks, getSparklineData } from '@/lib/db/storage';
import type { TrendingStock } from '@/lib/db/storage';

const mockTrending = getTrendingStocks as jest.MockedFunction<typeof getTrendingStocks>;
const mockFading   = getFadingStocks  as jest.MockedFunction<typeof getFadingStocks>;
const mockSparkline = getSparklineData as jest.MockedFunction<typeof getSparklineData>;

const sampleStock: TrendingStock = {
  ticker: 'GME',
  mentionCount: 250,
  mentionsPrev: 100,
  mentionDelta: 150,
  sentimentScore: 0.75,
  sentimentCategory: 'strong_bullish',
  velocity: 150,
  timestamp: 1700000000000,
};

beforeEach(() => {
  mockTrending.mockResolvedValue([sampleStock]);
  mockFading.mockResolvedValue([{ ...sampleStock, ticker: 'AMC', velocity: -30 }]);
  mockSparkline.mockResolvedValue([10, 20, 15]);
  mockRateLimiterCheck.mockReturnValue({ allowed: true, remaining: 59 });
});

afterEach(() => {
  jest.clearAllMocks();
});

describe('GET /api/public/v1/stocks/trending', () => {
  it('returns 200 with success:true', async () => {
    const req = new Request('http://localhost/api/public/v1/stocks/trending');
    const res = await GET(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
  });

  it('returns trending and fading arrays', async () => {
    const req = new Request('http://localhost/api/public/v1/stocks/trending');
    const res = await GET(req);
    const body = await res.json();
    expect(Array.isArray(body.data.trending)).toBe(true);
    expect(Array.isArray(body.data.fading)).toBe(true);
  });

  it('works without auth cookie', async () => {
    const req = new Request('http://localhost/api/public/v1/stocks/trending');
    const res = await GET(req);
    expect(res.status).toBe(200);
  });

  it('has CORS header Access-Control-Allow-Origin: *', async () => {
    const req = new Request('http://localhost/api/public/v1/stocks/trending');
    const res = await GET(req);
    expect(res.headers.get('access-control-allow-origin')).toBe('*');
  });

  it('has Cache-Control: public header', async () => {
    const req = new Request('http://localhost/api/public/v1/stocks/trending');
    const res = await GET(req);
    expect(res.headers.get('cache-control')).toContain('public');
  });

  it('accepts ?timeframe= param and returns 400 for invalid value', async () => {
    const req = new Request('http://localhost/api/public/v1/stocks/trending?timeframe=bad');
    const res = await GET(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.success).toBe(false);
    expect(body.error).toMatch(/timeframe/i);
  });

  it('CORS header present even on 400 response', async () => {
    const req = new Request('http://localhost/api/public/v1/stocks/trending?timeframe=bad');
    const res = await GET(req);
    expect(res.headers.get('access-control-allow-origin')).toBe('*');
  });

  it('returns 429 when rate limit exhausted', async () => {
    mockRateLimiterCheck.mockReturnValue({ allowed: false, remaining: 0, retryAfterMs: 10_000 });
    const req = new Request('http://localhost/api/public/v1/stocks/trending');
    const res = await GET(req);
    expect(res.status).toBe(429);
    const body = await res.json();
    expect(body.success).toBe(false);
    expect(body.error).toMatch(/rate limit/i);
  });

  it('accepts valid timeframe param and returns data', async () => {
    const req = new Request('http://localhost/api/public/v1/stocks/trending?timeframe=1h');
    const res = await GET(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
  });

  it('response includes a timestamp field', async () => {
    const req = new Request('http://localhost/api/public/v1/stocks/trending');
    const res = await GET(req);
    const body = await res.json();
    expect(typeof body.data.timestamp).toBe('number');
  });
});
