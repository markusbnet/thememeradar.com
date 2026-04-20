// Mock storage to avoid DynamoDB calls
jest.mock('@/lib/db/storage', () => ({
  getTrendingStocks: jest.fn().mockResolvedValue([]),
  getFadingStocks: jest.fn().mockResolvedValue([]),
  getSparklineData: jest.fn().mockResolvedValue([]),
  getStockDetails: jest.fn().mockResolvedValue(null),
  getStockEvidence: jest.fn().mockResolvedValue([]),
  getStockHistory: jest.fn().mockResolvedValue({ mentions: [], sentiment: [] }),
  getStockTimeBreakdown: jest.fn().mockResolvedValue({ periods: [] }),
}));

jest.mock('@/lib/db/enrichment', () => ({
  getLatestEnrichment: jest.fn().mockResolvedValue(null),
  getEnrichmentMap: jest.fn().mockResolvedValue(new Map()),
}));

jest.mock('@/lib/db/prices', () => ({
  getLatestPrice: jest.fn().mockResolvedValue(null),
  getPriceHistory: jest.fn().mockResolvedValue([]),
  getLatestPriceMap: jest.fn().mockResolvedValue(new Map()),
}));

jest.mock('@/lib/db/apewisdom', () => ({
  getLatestApewisdomSnapshot: jest.fn().mockResolvedValue(null),
}));

jest.mock('@/lib/market/swaggystocks', () => ({
  getLatestOptionsActivity: jest.fn().mockResolvedValue(null),
}));

import { apiCache } from '@/lib/cache';

describe('API Load Testing', () => {
  beforeEach(() => {
    apiCache.clear();
  });

  it('should handle 50 concurrent requests to /api/stocks/trending', async () => {
    const { GET } = await import('@/app/api/stocks/trending/route');

    const requests = Array(50).fill(null).map(() =>
      GET(new Request('http://localhost/api/stocks/trending'))
    );
    const responses = await Promise.all(requests);

    const statuses = responses.map(r => r.status);
    expect(statuses.every(s => s === 200)).toBe(true);
  });

  it('should handle 50 concurrent requests to /api/health', async () => {
    const { GET } = await import('@/app/api/health/route');

    const requests = Array(50).fill(null).map(() => GET());
    const responses = await Promise.all(requests);

    const statuses = responses.map(r => r.status);
    expect(statuses.every(s => s === 200)).toBe(true);
  });

  it('should handle 50 concurrent requests to /api/stocks/:ticker', async () => {
    const { GET } = await import('@/app/api/stocks/[ticker]/route');

    const requests = Array(50).fill(null).map(() =>
      GET(
        new Request('http://localhost:3000/api/stocks/GME'),
        { params: Promise.resolve({ ticker: 'GME' }) }
      )
    );
    const responses = await Promise.all(requests);

    // All should return (200 or 404 since no data seeded)
    const statuses = responses.map(r => r.status);
    expect(statuses.every(s => s === 200 || s === 404)).toBe(true);
  });

  it('should respond within acceptable time under load', async () => {
    const { GET } = await import('@/app/api/stocks/trending/route');

    const start = Date.now();
    const requests = Array(50).fill(null).map(() =>
      GET(new Request('http://localhost/api/stocks/trending'))
    );
    await Promise.all(requests);
    const duration = Date.now() - start;

    // 50 concurrent requests should complete within 5 seconds
    expect(duration).toBeLessThan(5000);
  });
});
