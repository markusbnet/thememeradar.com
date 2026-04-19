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

jest.mock('@/lib/coverage/apewisdom', () => {
  const actual = jest.requireActual('@/lib/coverage/apewisdom');
  return actual; // use the real merge function
});

import { GET } from '@/app/api/stocks/trending/route';
import { apiCache } from '@/lib/cache';
import { getTrendingStocks, getFadingStocks, getSparklineData } from '@/lib/db/storage';
import type { TrendingStock } from '@/lib/db/storage';

const mockGetTrendingStocks = getTrendingStocks as jest.MockedFunction<typeof getTrendingStocks>;
const mockGetFadingStocks = getFadingStocks as jest.MockedFunction<typeof getFadingStocks>;
const mockGetSparklineData = getSparklineData as jest.MockedFunction<typeof getSparklineData>;

const mockTrendingStocks: TrendingStock[] = [
  {
    ticker: 'GME',
    mentionCount: 250,
    sentimentScore: 0.75,
    sentimentCategory: 'strong_bullish',
    velocity: 245,
    timestamp: 1700000000000,
  },
  {
    ticker: 'AMC',
    mentionCount: 180,
    sentimentScore: 0.45,
    sentimentCategory: 'bullish',
    velocity: 120,
    timestamp: 1700000000000,
  },
  {
    ticker: 'BBBY',
    mentionCount: 90,
    sentimentScore: 0.05,
    sentimentCategory: 'neutral',
    velocity: 30,
    timestamp: 1700000000000,
  },
];

const mockFadingStocks: TrendingStock[] = [
  {
    ticker: 'WISH',
    mentionCount: 210,
    sentimentScore: -0.35,
    sentimentCategory: 'bearish',
    velocity: -45,
    timestamp: 1700000000000,
  },
  {
    ticker: 'CLOV',
    mentionCount: 320,
    sentimentScore: -0.1,
    sentimentCategory: 'neutral',
    velocity: -65,
    timestamp: 1700000000000,
  },
];

describe('GET /api/stocks/trending', () => {
  beforeEach(() => {
    apiCache.clear();
    jest.clearAllMocks();
    // Default: return empty arrays so existing tests continue to pass
    mockGetTrendingStocks.mockResolvedValue([]);
    mockGetFadingStocks.mockResolvedValue([]);
    mockGetSparklineData.mockResolvedValue([]);
  });

  it('should return 200 with success response', async () => {
    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
  });

  it('should return trending and fading arrays', async () => {
    const response = await GET();
    const data = await response.json();

    expect(data.data).toBeDefined();
    expect(Array.isArray(data.data.trending)).toBe(true);
    expect(Array.isArray(data.data.fading)).toBe(true);
  });

  it('should include a timestamp', async () => {
    const before = Date.now();
    const response = await GET();
    const data = await response.json();
    const after = Date.now();

    expect(data.data.timestamp).toBeGreaterThanOrEqual(before);
    expect(data.data.timestamp).toBeLessThanOrEqual(after);
  });

  it('should return empty arrays when no data exists', async () => {
    const response = await GET();
    const data = await response.json();

    // With no scan data, both should be empty
    expect(data.data.trending).toEqual([]);
    expect(data.data.fading).toEqual([]);
  });

  describe('trending with data', () => {
    beforeEach(() => {
      mockGetTrendingStocks.mockResolvedValue(mockTrendingStocks);
      mockGetSparklineData.mockResolvedValue([10, 20, 30, 40, 50, 60, 70]);
    });

    it('should return all 3 trending stocks', async () => {
      const response = await GET();
      const data = await response.json();

      expect(data.data.trending).toHaveLength(3);
    });

    it('should include the correct structure for each trending stock', async () => {
      const response = await GET();
      const data = await response.json();

      const stock = data.data.trending[0];
      expect(stock).toHaveProperty('ticker', 'GME');
      expect(stock).toHaveProperty('mentionCount', 250);
      expect(stock).toHaveProperty('sentimentScore', 0.75);
      expect(stock).toHaveProperty('sentimentCategory', 'strong_bullish');
      expect(stock).toHaveProperty('velocity', 245);
      expect(stock).toHaveProperty('sparklineData');
    });

    it('should attach sparkline data to each trending stock', async () => {
      const response = await GET();
      const data = await response.json();

      for (const stock of data.data.trending) {
        expect(Array.isArray(stock.sparklineData)).toBe(true);
        expect(stock.sparklineData).toEqual([10, 20, 30, 40, 50, 60, 70]);
      }
    });

    it('should preserve velocity ordering from getTrendingStocks', async () => {
      const response = await GET();
      const data = await response.json();

      expect(data.data.trending[0].ticker).toBe('GME');
      expect(data.data.trending[1].ticker).toBe('AMC');
      expect(data.data.trending[2].ticker).toBe('BBBY');
    });
  });

  describe('fading with data', () => {
    beforeEach(() => {
      mockGetFadingStocks.mockResolvedValue(mockFadingStocks);
      mockGetSparklineData.mockResolvedValue([70, 60, 50, 40, 30, 20, 10]);
    });

    it('should return all 2 fading stocks', async () => {
      const response = await GET();
      const data = await response.json();

      expect(data.data.fading).toHaveLength(2);
    });

    it('should include the correct structure for each fading stock', async () => {
      const response = await GET();
      const data = await response.json();

      const stock = data.data.fading[0];
      expect(stock).toHaveProperty('ticker', 'WISH');
      expect(stock).toHaveProperty('mentionCount', 210);
      expect(stock).toHaveProperty('sentimentScore', -0.35);
      expect(stock).toHaveProperty('sentimentCategory', 'bearish');
      expect(stock).toHaveProperty('velocity', -45);
      expect(stock).toHaveProperty('sparklineData');
    });

    it('should have negative velocity for all fading stocks', async () => {
      const response = await GET();
      const data = await response.json();

      for (const stock of data.data.fading) {
        expect(stock.velocity).toBeLessThan(0);
      }
    });

    it('should attach sparkline data to each fading stock', async () => {
      const response = await GET();
      const data = await response.json();

      for (const stock of data.data.fading) {
        expect(Array.isArray(stock.sparklineData)).toBe(true);
        expect(stock.sparklineData).toEqual([70, 60, 50, 40, 30, 20, 10]);
      }
    });
  });

  describe('cache behavior', () => {
    beforeEach(() => {
      mockGetTrendingStocks.mockResolvedValue(mockTrendingStocks);
      mockGetFadingStocks.mockResolvedValue(mockFadingStocks);
      mockGetSparklineData.mockResolvedValue([1, 2, 3, 4, 5, 6, 7]);
    });

    it('should call getTrendingStocks only once when called twice in succession', async () => {
      await GET();
      await GET();

      expect(mockGetTrendingStocks).toHaveBeenCalledTimes(1);
    });

    it('should return cached data on the second call', async () => {
      const first = await GET();
      const firstData = await first.json();

      const second = await GET();
      const secondData = await second.json();

      expect(secondData.data.trending).toEqual(firstData.data.trending);
      expect(secondData.data.fading).toEqual(firstData.data.fading);
      expect(secondData.data.timestamp).toEqual(firstData.data.timestamp);
    });

    it('should not call getFadingStocks on the second call', async () => {
      await GET();
      await GET();

      expect(mockGetFadingStocks).toHaveBeenCalledTimes(1);
    });
  });

  describe('response timestamp', () => {
    it('should include a timestamp that is a recent number', async () => {
      const before = Date.now();
      const response = await GET();
      const after = Date.now();
      const data = await response.json();

      expect(typeof data.data.timestamp).toBe('number');
      expect(data.data.timestamp).toBeGreaterThanOrEqual(before);
      expect(data.data.timestamp).toBeLessThanOrEqual(after);
    });

    it('should return the same timestamp on cached calls', async () => {
      const first = await (await GET()).json();
      const second = await (await GET()).json();

      expect(second.data.timestamp).toBe(first.data.timestamp);
    });
  });

  describe('price data join', () => {
    beforeEach(() => {
      const { getLatestPriceMap } = jest.requireMock('@/lib/db/prices');
      mockGetTrendingStocks.mockResolvedValue(mockTrendingStocks);
      mockGetFadingStocks.mockResolvedValue([]);
      mockGetSparklineData.mockResolvedValue([]);
      getLatestPriceMap.mockResolvedValue(
        new Map([['GME', {
          ticker: 'GME',
          price: 24.50,
          changePct24h: 3.21,
          volume: 5000000,
          dayHigh: 25.0,
          dayLow: 23.8,
          dayOpen: 24.0,
          previousClose: 23.7,
          staleness: 'fresh',
          fetchedAt: Date.now() - 5 * 60 * 1000,
          ttl: Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60,
        }]])
      );
    });

    afterEach(() => {
      const { getLatestPriceMap } = jest.requireMock('@/lib/db/prices');
      getLatestPriceMap.mockResolvedValue(new Map());
    });

    it('includes price data for tickers with price rows', async () => {
      const response = await GET();
      const data = await response.json();

      const gme = data.data.trending.find((s: any) => s.ticker === 'GME');
      expect(gme.price).toBeDefined();
      expect(gme.price.price).toBe(24.50);
      expect(gme.price.changePct24h).toBe(3.21);
      expect(gme.price.staleness).toBe('fresh');
    });

    it('returns null price for tickers with no price row', async () => {
      const response = await GET();
      const data = await response.json();

      const amc = data.data.trending.find((s: any) => s.ticker === 'AMC');
      expect(amc.price).toBeNull();
    });

    it('response is 200 even when price map is empty', async () => {
      const { getLatestPriceMap } = jest.requireMock('@/lib/db/prices');
      getLatestPriceMap.mockResolvedValue(new Map());

      const response = await GET();
      expect(response.status).toBe(200);
    });
  });

  describe('error handling', () => {
    it('should return 500 with the error message when getTrendingStocks throws', async () => {
      mockGetTrendingStocks.mockRejectedValueOnce(new Error('DynamoDB connection failed'));

      const response = await GET();
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.success).toBe(false);
      expect(data.error).toBe('DynamoDB connection failed');
    });

    it('should return 500 with fallback message when a non-Error is thrown', async () => {
      mockGetTrendingStocks.mockRejectedValueOnce('network failure');

      const response = await GET();
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.success).toBe(false);
      expect(data.error).toBe('Failed to fetch trending stocks');
    });
  });
});
