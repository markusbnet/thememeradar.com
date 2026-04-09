import { GET } from '@/app/api/stocks/[ticker]/route';
import type { StoredStockMention, StoredEvidence } from '@/lib/db/storage';

jest.mock('@/lib/db/storage', () => ({
  getStockDetails: jest.fn(),
  getStockEvidence: jest.fn(),
  getStockHistory: jest.fn(),
  getStockTimeBreakdown: jest.fn(),
}));

import {
  getStockDetails,
  getStockEvidence,
  getStockHistory,
  getStockTimeBreakdown,
} from '@/lib/db/storage';

const mockGetStockDetails = getStockDetails as jest.MockedFunction<typeof getStockDetails>;
const mockGetStockEvidence = getStockEvidence as jest.MockedFunction<typeof getStockEvidence>;
const mockGetStockHistory = getStockHistory as jest.MockedFunction<typeof getStockHistory>;
const mockGetStockTimeBreakdown = getStockTimeBreakdown as jest.MockedFunction<typeof getStockTimeBreakdown>;

const mockDetails: StoredStockMention = {
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
  subredditBreakdown: { wallstreetbets: 80, stocks: 40 },
  topKeywords: ['moon', 'diamond hands', 'yolo'],
  ttl: 1702592000,
};

const mockEvidence: StoredEvidence[] = [
  {
    ticker: 'GME',
    evidenceId: 'post123',
    type: 'post',
    text: 'GME to the moon! Diamond hands 💎🙌',
    keywords: ['moon', 'diamond hands'],
    sentimentScore: 0.9,
    sentimentCategory: 'strong_bullish',
    upvotes: 1500,
    subreddit: 'wallstreetbets',
    createdAt: 1700000000000,
    ttl: 1702592000,
  },
];

const mockHistory = {
  mentions: [
    { label: 'Mon 4/7', value: 50 },
    { label: 'Tue 4/8', value: 70 },
    { label: 'Wed 4/9', value: 120 },
  ],
  sentiment: [
    { label: 'Mon 4/7', value: 0.5 },
    { label: 'Tue 4/8', value: 0.65 },
    { label: 'Wed 4/9', value: 0.75 },
  ],
};

const mockTimeBreakdown = {
  periods: [
    { label: '24 Hours', mentions: 120, bullishPct: 75, neutralPct: 17, bearishPct: 8 },
    { label: '7 Days', mentions: 850, bullishPct: 70, neutralPct: 20, bearishPct: 10 },
    { label: '30 Days', mentions: 3200, bullishPct: 65, neutralPct: 22, bearishPct: 13 },
  ],
};

describe('GET /api/stocks/[ticker]', () => {
  const createRequest = (ticker: string) => {
    return new Request(`http://localhost:3000/api/stocks/${ticker}`);
  };

  beforeEach(() => {
    jest.clearAllMocks();
    // Default: storage returns no data (404 path)
    mockGetStockDetails.mockResolvedValue(null);
    mockGetStockEvidence.mockResolvedValue([]);
    mockGetStockHistory.mockResolvedValue({ mentions: [], sentiment: [] });
    mockGetStockTimeBreakdown.mockResolvedValue({ periods: [] });
  });

  it('should return 404 for unknown ticker', async () => {
    const response = await GET(
      createRequest('ZZZZZ'),
      { params: Promise.resolve({ ticker: 'ZZZZZ' }) }
    );
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.success).toBe(false);
    expect(data.error).toBe('Stock not found');
  });

  it('should uppercase the ticker param', async () => {
    const response = await GET(
      createRequest('aapl'),
      { params: Promise.resolve({ ticker: 'aapl' }) }
    );
    const data = await response.json();

    // Even though not found, the route should have uppercased
    expect(response.status).toBe(404);
    expect(data.success).toBe(false);
  });

  it('should return standard error format on 404', async () => {
    const response = await GET(
      createRequest('UNKNOWN'),
      { params: Promise.resolve({ ticker: 'UNKNOWN' }) }
    );
    const data = await response.json();

    expect(data).toEqual({
      success: false,
      error: 'Stock not found',
    });
  });

  describe('200 success path', () => {
    beforeEach(() => {
      mockGetStockDetails.mockResolvedValue(mockDetails);
      mockGetStockEvidence.mockResolvedValue(mockEvidence);
      mockGetStockHistory.mockResolvedValue(mockHistory);
      mockGetStockTimeBreakdown.mockResolvedValue(mockTimeBreakdown);
    });

    it('should return 200 when stock data exists', async () => {
      const response = await GET(
        createRequest('GME'),
        { params: Promise.resolve({ ticker: 'GME' }) }
      );
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
    });

    it('should include all expected top-level fields in response data', async () => {
      const response = await GET(
        createRequest('GME'),
        { params: Promise.resolve({ ticker: 'GME' }) }
      );
      const data = await response.json();

      expect(data.data).toBeDefined();
      expect(data.data).toHaveProperty('ticker');
      expect(data.data).toHaveProperty('details');
      expect(data.data).toHaveProperty('evidence');
      expect(data.data).toHaveProperty('history');
      expect(data.data).toHaveProperty('timeBreakdown');
      expect(data.data).toHaveProperty('timestamp');
    });

    it('should return the uppercased ticker in response data', async () => {
      const response = await GET(
        createRequest('GME'),
        { params: Promise.resolve({ ticker: 'GME' }) }
      );
      const data = await response.json();

      expect(data.data.ticker).toBe('GME');
    });

    it('should uppercase mixed case URL parameters in the response', async () => {
      mockGetStockDetails.mockResolvedValue({ ...mockDetails, ticker: 'GME' });

      const response = await GET(
        createRequest('gme'),
        { params: Promise.resolve({ ticker: 'gme' }) }
      );
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.data.ticker).toBe('GME');
    });

    it('should return details matching the stored stock mention', async () => {
      const response = await GET(
        createRequest('GME'),
        { params: Promise.resolve({ ticker: 'GME' }) }
      );
      const data = await response.json();

      expect(data.data.details).toEqual(mockDetails);
    });

    it('should return evidence array', async () => {
      const response = await GET(
        createRequest('GME'),
        { params: Promise.resolve({ ticker: 'GME' }) }
      );
      const data = await response.json();

      expect(Array.isArray(data.data.evidence)).toBe(true);
      expect(data.data.evidence).toHaveLength(1);
      expect(data.data.evidence[0]).toEqual(mockEvidence[0]);
    });

    it('should return history with mentions and sentiment arrays', async () => {
      const response = await GET(
        createRequest('GME'),
        { params: Promise.resolve({ ticker: 'GME' }) }
      );
      const data = await response.json();

      expect(data.data.history).toBeDefined();
      expect(Array.isArray(data.data.history.mentions)).toBe(true);
      expect(Array.isArray(data.data.history.sentiment)).toBe(true);
      expect(data.data.history).toEqual(mockHistory);
    });

    it('should return timeBreakdown with periods array', async () => {
      const response = await GET(
        createRequest('GME'),
        { params: Promise.resolve({ ticker: 'GME' }) }
      );
      const data = await response.json();

      expect(data.data.timeBreakdown).toBeDefined();
      expect(Array.isArray(data.data.timeBreakdown.periods)).toBe(true);
      expect(data.data.timeBreakdown).toEqual(mockTimeBreakdown);
    });

    it('should include a timestamp in the response', async () => {
      const before = Date.now();
      const response = await GET(
        createRequest('GME'),
        { params: Promise.resolve({ ticker: 'GME' }) }
      );
      const after = Date.now();
      const data = await response.json();

      expect(data.data.timestamp).toBeGreaterThanOrEqual(before);
      expect(data.data.timestamp).toBeLessThanOrEqual(after);
    });

    it('should call storage functions with the uppercased ticker', async () => {
      await GET(
        createRequest('gme'),
        { params: Promise.resolve({ ticker: 'gme' }) }
      );

      expect(mockGetStockDetails).toHaveBeenCalledWith('GME');
      expect(mockGetStockEvidence).toHaveBeenCalledWith('GME', 10);
      expect(mockGetStockHistory).toHaveBeenCalledWith('GME', 7);
      expect(mockGetStockTimeBreakdown).toHaveBeenCalledWith('GME');
    });
  });

  describe('error handling', () => {
    it('should return 500 when storage throws an error', async () => {
      mockGetStockDetails.mockRejectedValue(new Error('DynamoDB connection failed'));

      const response = await GET(
        createRequest('GME'),
        { params: Promise.resolve({ ticker: 'GME' }) }
      );
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.success).toBe(false);
      expect(data.error).toBe('DynamoDB connection failed');
    });

    it('should return generic error message for non-Error throws', async () => {
      mockGetStockDetails.mockRejectedValue('unexpected failure');

      const response = await GET(
        createRequest('GME'),
        { params: Promise.resolve({ ticker: 'GME' }) }
      );
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.success).toBe(false);
      expect(data.error).toBe('Failed to fetch stock details');
    });
  });
});
