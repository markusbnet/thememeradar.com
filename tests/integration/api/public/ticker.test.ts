jest.mock('@/lib/db/storage', () => ({
  getStockDetails: jest.fn(),
  getStockEvidence: jest.fn(),
  getStockHistory: jest.fn(),
  getStockTimeBreakdown: jest.fn(),
}));
jest.mock('@/lib/db/enrichment', () => ({ getLatestEnrichment: jest.fn().mockResolvedValue(null) }));
jest.mock('@/lib/db/prices', () => ({
  getLatestPrice: jest.fn().mockResolvedValue(null),
  getPriceHistory: jest.fn().mockResolvedValue([]),
}));
jest.mock('@/lib/market/swaggystocks', () => ({ getLatestOptionsActivity: jest.fn().mockResolvedValue(null) }));

const mockRateLimiterCheck = jest.fn().mockReturnValue({ allowed: true, remaining: 59 });
jest.mock('@/lib/public-api-rate-limiter', () => ({
  publicRateLimiter: { check: (...args: unknown[]) => mockRateLimiterCheck(...args) },
  getClientIP: jest.fn().mockReturnValue('127.0.0.1'),
}));

import { GET } from '@/app/api/public/v1/stocks/[ticker]/route';
import {
  getStockDetails,
  getStockEvidence,
  getStockHistory,
  getStockTimeBreakdown,
} from '@/lib/db/storage';

const mockDetails   = getStockDetails       as jest.MockedFunction<typeof getStockDetails>;
const mockEvidence  = getStockEvidence      as jest.MockedFunction<typeof getStockEvidence>;
const mockHistory   = getStockHistory       as jest.MockedFunction<typeof getStockHistory>;
const mockBreakdown = getStockTimeBreakdown as jest.MockedFunction<typeof getStockTimeBreakdown>;

const sampleDetails = {
  ticker: 'GME',
  mentionCount: 200,
  sentimentScore: 0.7,
  sentimentCategory: 'bullish',
  velocity: 120,
  timestamp: Date.now(),
};

beforeEach(() => {
  mockDetails.mockResolvedValue(sampleDetails as Parameters<typeof mockDetails.mockResolvedValue>[0]);
  mockEvidence.mockResolvedValue([]);
  mockHistory.mockResolvedValue([]);
  mockBreakdown.mockResolvedValue([]);
  mockRateLimiterCheck.mockReturnValue({ allowed: true, remaining: 59 });
});

afterEach(() => jest.clearAllMocks());

async function callTicker(ticker: string) {
  const req = new Request(`http://localhost/api/public/v1/stocks/${ticker}`);
  return GET(req, { params: Promise.resolve({ ticker }) });
}

describe('GET /api/public/v1/stocks/[ticker]', () => {
  it('returns 200 for a known ticker', async () => {
    const res = await callTicker('GME');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
  });

  it('returns ticker in response', async () => {
    const res = await callTicker('gme');
    const body = await res.json();
    expect(body.data.ticker).toBe('GME');
  });

  it('works without auth cookie', async () => {
    const res = await callTicker('GME');
    expect(res.status).toBe(200);
  });

  it('has CORS header Access-Control-Allow-Origin: *', async () => {
    const res = await callTicker('GME');
    expect(res.headers.get('access-control-allow-origin')).toBe('*');
  });

  it('returns 404 when stock not found', async () => {
    mockDetails.mockResolvedValue(null);
    const res = await callTicker('UNKNOWN');
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.success).toBe(false);
    expect(body.error).toMatch(/not found/i);
  });

  it('returns 429 when rate limited', async () => {
    mockRateLimiterCheck.mockReturnValue({ allowed: false, remaining: 0, retryAfterMs: 10_000 });
    const res = await callTicker('GME');
    expect(res.status).toBe(429);
  });

  it('CORS header present on 404 response', async () => {
    mockDetails.mockResolvedValue(null);
    const res = await callTicker('NOPE');
    expect(res.headers.get('access-control-allow-origin')).toBe('*');
  });
});
