/**
 * LunarCrush HTTP client unit tests
 * All HTTP calls are intercepted via global fetch mock — no network traffic.
 */

import { LunarCrushClient, createLunarCrushClient } from '@/lib/lunarcrush';
import type {
  LunarCrushStockSummary,
  LunarCrushTopicDetail,
  LunarCrushTimeSeriesPoint,
  LunarCrushPost,
} from '@/types/lunarcrush';

// Factory for a minimal valid stock summary
const makeSummary = (overrides: Partial<LunarCrushStockSummary> = {}): LunarCrushStockSummary => ({
  symbol: 'GME',
  name: 'GameStop Corp.',
  price: 24.50,
  volume: 5_000_000,
  percent_change_24h: 12.5,
  market_cap: 9_000_000_000,
  galaxy_score: 72,
  alt_rank: 38,
  sentiment: 3.8,
  social_dominance: 4.2,
  ...overrides,
});

const makeTopicDetail = (overrides: Partial<LunarCrushTopicDetail> = {}): LunarCrushTopicDetail => ({
  symbol: 'GME',
  name: 'GameStop Corp.',
  price: 24.50,
  volume_24h: 5_000_000,
  percent_change_24h: 12.5,
  market_cap: 9_000_000_000,
  galaxy_score: 72,
  alt_rank: 38,
  sentiment: 3.8,
  social_dominance: 4.2,
  interactions: 80_000,
  posts_active: 1_500,
  contributors_active: 600,
  engagements_by_network: { reddit: 45000, x: 30000, youtube: 5000 },
  mentions_by_network: { reddit: 900, x: 500, youtube: 100 },
  top_creators: [
    { screen_name: 'DeepFuckingValue', network: 'reddit', influencer_rank: 5, followers: 180000, posts: 3, engagements: 42000 },
  ],
  ...overrides,
});

const makeTimeSeriesPoint = (overrides: Partial<LunarCrushTimeSeriesPoint> = {}): LunarCrushTimeSeriesPoint => ({
  time: 1_700_000_000,
  close: 24.50,
  volume_24h: 5_000_000,
  sentiment: 3.8,
  social_dominance: 4.2,
  interactions: 80_000,
  posts_active: 1_500,
  ...overrides,
});

const makePost = (overrides: Partial<LunarCrushPost> = {}): LunarCrushPost => ({
  network: 'reddit',
  creator: 'apes_together_strong',
  text: 'GME to the moon! Diamond hands forever 💎🙌',
  engagements: 12000,
  created_at: 1_700_000_000,
  url: 'https://reddit.com/r/wallstreetbets/comments/test123',
  ...overrides,
});

function mockFetchOk(data: unknown): void {
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ data }),
    text: async () => '',
  } as Response);
}

function mockFetchError(status: number, body = 'Bad Request'): void {
  global.fetch = jest.fn().mockResolvedValue({
    ok: false,
    status,
    text: async () => body,
  } as Response);
}

afterEach(() => {
  jest.restoreAllMocks();
  delete process.env.LUNARCRUSH_API_KEY;
});

describe('LunarCrushClient', () => {
  const client = new LunarCrushClient('test-api-key-abc123');

  describe('getStocks', () => {
    it('fetches stocks and returns the data array', async () => {
      const payload = [makeSummary({ symbol: 'GME' }), makeSummary({ symbol: 'AMC' })];
      mockFetchOk(payload);

      const result = await client.getStocks();
      expect(result).toHaveLength(2);
      expect(result[0].symbol).toBe('GME');
    });

    it('sends Authorization header with Bearer token', async () => {
      mockFetchOk([makeSummary()]);
      await client.getStocks();

      const call = (global.fetch as jest.Mock).mock.calls[0];
      expect(call[1]?.headers?.['Authorization']).toBe('Bearer test-api-key-abc123');
    });

    it('includes sort and limit params in the request URL', async () => {
      mockFetchOk([]);
      await client.getStocks('galaxy_score', 50);

      const calledUrl = (global.fetch as jest.Mock).mock.calls[0][0] as string;
      expect(calledUrl).toContain('sort=galaxy_score');
      expect(calledUrl).toContain('limit=50');
    });

    it('throws on non-2xx response', async () => {
      mockFetchError(429, 'Too Many Requests');
      await expect(client.getStocks()).rejects.toThrow('429');
    });
  });

  describe('getTopic', () => {
    it('fetches topic detail for a ticker symbol', async () => {
      const payload = makeTopicDetail({ symbol: 'GME' });
      mockFetchOk(payload);

      const result = await client.getTopic('GME');
      expect(result.symbol).toBe('GME');
      expect(result.top_creators).toHaveLength(1);
    });

    it('URL-encodes the ticker with $ prefix', async () => {
      mockFetchOk(makeTopicDetail());
      await client.getTopic('GME');

      const calledUrl = (global.fetch as jest.Mock).mock.calls[0][0] as string;
      // $GME encoded → %24GME
      expect(calledUrl).toContain('%24GME');
    });

    it('includes engagements_by_network and mentions_by_network in response', async () => {
      mockFetchOk(makeTopicDetail());
      const result = await client.getTopic('GME');

      expect(result.engagements_by_network).toBeDefined();
      expect(result.mentions_by_network).toBeDefined();
      expect(result.engagements_by_network.reddit).toBe(45000);
    });
  });

  describe('getTopicTimeSeries', () => {
    it('returns an array of time series points', async () => {
      const points = [makeTimeSeriesPoint({ time: 1_700_000_000 })];
      mockFetchOk(points);

      const result = await client.getTopicTimeSeries('GME', '1w');
      expect(Array.isArray(result)).toBe(true);
      expect(result[0].close).toBe(24.50);
    });

    it('includes interval and metrics params in URL', async () => {
      mockFetchOk([]);
      await client.getTopicTimeSeries('GME', '1m');

      const calledUrl = (global.fetch as jest.Mock).mock.calls[0][0] as string;
      expect(calledUrl).toContain('interval=1m');
      expect(calledUrl).toContain('metrics=');
    });

    it('defaults to 1w interval', async () => {
      mockFetchOk([]);
      await client.getTopicTimeSeries('AMC');

      const calledUrl = (global.fetch as jest.Mock).mock.calls[0][0] as string;
      expect(calledUrl).toContain('interval=1w');
    });
  });

  describe('getTopicPosts', () => {
    it('returns array of posts with required fields', async () => {
      const posts = [makePost({ network: 'reddit' }), makePost({ network: 'x' })];
      mockFetchOk(posts);

      const result = await client.getTopicPosts('GME');
      expect(result).toHaveLength(2);
      expect(result[0].network).toBe('reddit');
      expect(result[0].url).toBeDefined();
    });

    it('includes limit param in URL', async () => {
      mockFetchOk([]);
      await client.getTopicPosts('GME', 5);

      const calledUrl = (global.fetch as jest.Mock).mock.calls[0][0] as string;
      expect(calledUrl).toContain('limit=5');
    });
  });
});

describe('createLunarCrushClient', () => {
  it('returns null and warns when LUNARCRUSH_API_KEY is not set', () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    delete process.env.LUNARCRUSH_API_KEY;

    const client = createLunarCrushClient();
    expect(client).toBeNull();
    warnSpy.mockRestore();
  });

  it('returns a LunarCrushClient instance when API key is set', () => {
    process.env.LUNARCRUSH_API_KEY = 'real-key-xyz';
    const client = createLunarCrushClient();
    expect(client).toBeInstanceOf(LunarCrushClient);
  });
});
