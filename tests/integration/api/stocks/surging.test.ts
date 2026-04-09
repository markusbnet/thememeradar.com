import { GET } from '@/app/api/stocks/surging/route';
import type { SurgeStock } from '@/lib/db/surge';

jest.mock('@/lib/db/surge', () => ({
  getSurgingStocks: jest.fn(),
}));

import { getSurgingStocks } from '@/lib/db/surge';

const mockGetSurgingStocks = getSurgingStocks as jest.MockedFunction<typeof getSurgingStocks>;

const mockSurgeStocks: SurgeStock[] = [
  {
    ticker: 'GME',
    mentionCount: 120,
    baselineMentions: 15.0,
    surgeMultiplier: 8.0,
    surgeScore: 0.87,
    sentimentScore: 0.75,
    sentimentCategory: 'strong_bullish',
    detectedAt: 1700000000000,
    sparklineData: [10, 12, 18, 20, 120],
  },
  {
    ticker: 'AMC',
    mentionCount: 85,
    baselineMentions: 10.0,
    surgeMultiplier: 8.5,
    surgeScore: 0.82,
    sentimentScore: 0.45,
    sentimentCategory: 'bullish',
    detectedAt: 1700000000000,
    sparklineData: [8, 9, 11, 12, 85],
  },
];

describe('GET /api/stocks/surging', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetSurgingStocks.mockResolvedValue([]);
  });

  it('should return 200 with success response', async () => {
    const request = new Request('http://localhost:3000/api/stocks/surging');
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
  });

  it('should return surging array', async () => {
    const request = new Request('http://localhost:3000/api/stocks/surging');
    const response = await GET(request);
    const data = await response.json();

    expect(data.data).toBeDefined();
    expect(Array.isArray(data.data.surging)).toBe(true);
  });

  it('should include a timestamp', async () => {
    const before = Date.now();
    const request = new Request('http://localhost:3000/api/stocks/surging');
    const response = await GET(request);
    const data = await response.json();
    const after = Date.now();

    expect(data.data.timestamp).toBeGreaterThanOrEqual(before);
    expect(data.data.timestamp).toBeLessThanOrEqual(after);
  });

  it('should return empty surging array when no data exists', async () => {
    const request = new Request('http://localhost:3000/api/stocks/surging');
    const response = await GET(request);
    const data = await response.json();

    expect(data.data.surging).toEqual([]);
  });

  it('should respect the limit query parameter', async () => {
    const request = new Request('http://localhost:3000/api/stocks/surging?limit=3');
    const response = await GET(request);
    const data = await response.json();

    expect(data.data.surging.length).toBeLessThanOrEqual(3);
  });

  describe('surging with data', () => {
    beforeEach(() => {
      mockGetSurgingStocks.mockResolvedValue(mockSurgeStocks);
    });

    it('should return all surge stocks from the mock', async () => {
      const request = new Request('http://localhost:3000/api/stocks/surging');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.surging).toHaveLength(2);
    });

    it('should include all required fields on each surge stock', async () => {
      const request = new Request('http://localhost:3000/api/stocks/surging');
      const response = await GET(request);
      const data = await response.json();

      const stock = data.data.surging[0];
      expect(stock).toHaveProperty('ticker');
      expect(stock).toHaveProperty('surgeScore');
      expect(stock).toHaveProperty('mentionCount');
      expect(stock).toHaveProperty('baselineMentions');
      expect(stock).toHaveProperty('sparklineData');
      expect(stock).toHaveProperty('sentimentCategory');
      expect(stock).toHaveProperty('sentimentScore');
      expect(stock).toHaveProperty('detectedAt');
    });

    it('should return correct field values for the first surge stock', async () => {
      const request = new Request('http://localhost:3000/api/stocks/surging');
      const response = await GET(request);
      const data = await response.json();

      const stock = data.data.surging[0];
      expect(stock.ticker).toBe('GME');
      expect(stock.surgeScore).toBe(0.87);
      expect(stock.mentionCount).toBe(120);
      expect(stock.baselineMentions).toBe(15.0);
      expect(stock.sparklineData).toEqual([10, 12, 18, 20, 120]);
      expect(stock.sentimentCategory).toBe('strong_bullish');
      expect(stock.sentimentScore).toBe(0.75);
      expect(stock.detectedAt).toBe(1700000000000);
    });

    it('should return sparklineData as an array of numbers', async () => {
      const request = new Request('http://localhost:3000/api/stocks/surging');
      const response = await GET(request);
      const data = await response.json();

      for (const stock of data.data.surging) {
        expect(Array.isArray(stock.sparklineData)).toBe(true);
        for (const point of stock.sparklineData) {
          expect(typeof point).toBe('number');
        }
      }
    });
  });

  describe('limit parameter', () => {
    beforeEach(() => {
      const threeStocks: SurgeStock[] = [
        ...mockSurgeStocks,
        {
          ticker: 'BB',
          mentionCount: 60,
          baselineMentions: 8.0,
          surgeMultiplier: 7.5,
          surgeScore: 0.78,
          sentimentScore: 0.3,
          sentimentCategory: 'bullish',
          detectedAt: 1700000000000,
          sparklineData: [5, 7, 9, 10, 60],
        },
      ];
      mockGetSurgingStocks.mockResolvedValue(threeStocks);
    });

    it('should pass the limit param to getSurgingStocks and return only that many', async () => {
      // Mock returns 3 stocks but getSurgingStocks already applies the limit internally;
      // here we verify the route passes limit=2 to the function.
      mockGetSurgingStocks.mockResolvedValue(mockSurgeStocks); // 2 items (simulating limit=2 applied)

      const request = new Request('http://localhost:3000/api/stocks/surging?limit=2');
      const response = await GET(request);
      const data = await response.json();

      expect(mockGetSurgingStocks).toHaveBeenCalledWith(2);
      expect(data.data.surging.length).toBeLessThanOrEqual(2);
    });

    it('should call getSurgingStocks with the parsed limit value', async () => {
      const request = new Request('http://localhost:3000/api/stocks/surging?limit=3');
      await GET(request);

      expect(mockGetSurgingStocks).toHaveBeenCalledWith(3);
    });

    it('should cap limit at 10 even when a higher value is passed', async () => {
      const request = new Request('http://localhost:3000/api/stocks/surging?limit=99');
      await GET(request);

      expect(mockGetSurgingStocks).toHaveBeenCalledWith(10);
    });

    it('should default to limit 5 when no limit param is provided', async () => {
      const request = new Request('http://localhost:3000/api/stocks/surging');
      await GET(request);

      expect(mockGetSurgingStocks).toHaveBeenCalledWith(5);
    });
  });

  describe('error handling', () => {
    it('should return 500 when getSurgingStocks throws an Error', async () => {
      mockGetSurgingStocks.mockRejectedValue(new Error('DynamoDB connection failed'));

      const request = new Request('http://localhost:3000/api/stocks/surging');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.success).toBe(false);
      expect(data.error).toBe('DynamoDB connection failed');
    });

    it('should return generic error message for non-Error throws', async () => {
      mockGetSurgingStocks.mockRejectedValue('unexpected string failure');

      const request = new Request('http://localhost:3000/api/stocks/surging');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.success).toBe(false);
      expect(data.error).toBe('Failed to fetch surging stocks');
    });

    it('should return standard error shape on failure', async () => {
      mockGetSurgingStocks.mockRejectedValue(new Error('timeout'));

      const request = new Request('http://localhost:3000/api/stocks/surging');
      const response = await GET(request);
      const data = await response.json();

      expect(data).toMatchObject({
        success: false,
        error: expect.any(String),
      });
    });
  });
});
