jest.mock('@/lib/db/storage', () => ({
  getStockDetails: jest.fn(),
  getStockMentionRange: jest.fn(),
}));
jest.mock('@/lib/db/prices', () => ({
  getPriceHistory: jest.fn().mockResolvedValue([]),
}));
jest.mock('@/lib/auth/jwt', () => ({
  verifyToken: jest.fn().mockReturnValue({ userId: 'user-1' }),
}));

import { GET } from '@/app/api/stocks/[ticker]/export/route';
import { getStockDetails, getStockMentionRange } from '@/lib/db/storage';
import { verifyToken } from '@/lib/auth/jwt';
import type { StoredStockMention } from '@/lib/db/storage';

const mockGetStockDetails    = getStockDetails    as jest.MockedFunction<typeof getStockDetails>;
const mockGetMentionRange    = getStockMentionRange as jest.MockedFunction<typeof getStockMentionRange>;
const mockVerifyToken        = verifyToken        as jest.MockedFunction<typeof verifyToken>;

const sampleDetails: StoredStockMention = {
  ticker: 'GME',
  timestamp: 1700000000000,
  mentionCount: 120,
  uniquePosts: 40,
  uniqueComments: 80,
  avgSentimentScore: 0.75,
  sentimentCategory: 'strong_bullish',
  bullishCount: 90,
  bearishCount: 10,
  neutralCount: 20,
  totalUpvotes: 5000,
  subredditBreakdown: {},
  topKeywords: [],
  ttl: 1702592000,
};

const sampleMentions: StoredStockMention[] = [
  { ...sampleDetails, timestamp: 1700000000000, mentionCount: 80 },
  { ...sampleDetails, timestamp: 1700000900000, mentionCount: 120 },
];

function makeRequest(ticker: string, search = '') {
  const cookieName = process.env.SESSION_COOKIE_NAME || 'meme_radar_session';
  return new Request(`http://localhost/api/stocks/${ticker}/export${search}`, {
    headers: { cookie: `${cookieName}=valid-token` },
  });
}

beforeEach(() => {
  mockGetStockDetails.mockResolvedValue(sampleDetails as Parameters<typeof mockGetStockDetails.mockResolvedValue>[0]);
  mockGetMentionRange.mockResolvedValue(sampleMentions);
  mockVerifyToken.mockReturnValue({ userId: 'user-1', email: 'u@test.com', iat: 0, exp: 9999999999 });
});

afterEach(() => jest.clearAllMocks());

async function call(ticker: string, search = '') {
  const req = makeRequest(ticker, search);
  return GET(req, { params: Promise.resolve({ ticker }) });
}

describe('GET /api/stocks/:ticker/export', () => {
  it('returns 200 with CSV content-type by default', async () => {
    const res = await call('GME');
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toMatch(/text\/csv/);
  });

  it('CSV response has Content-Disposition attachment header', async () => {
    const res = await call('GME');
    const cd = res.headers.get('content-disposition') ?? '';
    expect(cd).toMatch(/attachment/);
    expect(cd).toMatch(/GME/);
  });

  it('CSV body contains header row', async () => {
    const res = await call('GME');
    const text = await res.text();
    const firstLine = text.split('\n')[0];
    expect(firstLine).toContain('timestamp');
    expect(firstLine).toContain('mentionCount');
    expect(firstLine).toContain('sentimentScore');
  });

  it('CSV body has one data row per mention bucket', async () => {
    const res = await call('GME');
    const text = await res.text();
    const lines = text.trim().split('\n');
    expect(lines).toHaveLength(sampleMentions.length + 1); // header + data
  });

  it('returns JSON when format=json', async () => {
    const res = await call('GME', '?format=json');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(Array.isArray(body.data.rows)).toBe(true);
    expect(body.data.rows).toHaveLength(sampleMentions.length);
  });

  it('returns 400 for invalid format param', async () => {
    const res = await call('GME', '?format=excel');
    expect(res.status).toBe(400);
  });

  it('returns 400 for invalid range param', async () => {
    const res = await call('GME', '?range=365d');
    expect(res.status).toBe(400);
  });

  it('accepts valid range=7d', async () => {
    const res = await call('GME', '?range=7d');
    expect(res.status).toBe(200);
  });

  it('accepts valid range=30d', async () => {
    const res = await call('GME', '?range=30d');
    expect(res.status).toBe(200);
  });

  it('returns 401 without auth cookie', async () => {
    mockVerifyToken.mockReturnValue(null);
    const res = await GET(
      new Request('http://localhost/api/stocks/GME/export'),
      { params: Promise.resolve({ ticker: 'GME' }) },
    );
    expect(res.status).toBe(401);
  });

  it('returns 404 when ticker does not exist', async () => {
    mockGetStockDetails.mockResolvedValue(null);
    const res = await call('UNKNOWN');
    expect(res.status).toBe(404);
  });

  it('ticker in CSV filename is uppercased', async () => {
    const res = await call('gme');
    const cd = res.headers.get('content-disposition') ?? '';
    expect(cd).toMatch(/GME/);
  });
});
