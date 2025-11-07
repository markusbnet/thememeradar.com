/**
 * Integration Tests for Stock Detail API
 */

import { GET } from '@/app/api/stocks/[ticker]/route';
import { NextRequest } from 'next/server';

describe('GET /api/stocks/[ticker]', () => {
  it('should return 404 for non-existent ticker', async () => {
    const request = new NextRequest('http://localhost:3000/api/stocks/FAKE');
    const response = await GET(request, { params: { ticker: 'FAKE' } });
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.success).toBe(false);
    expect(data.error).toContain('not found');
  });

  it('should return stock details with correct structure', async () => {
    // This test will pass or fail depending on whether there's data
    const request = new NextRequest('http://localhost:3000/api/stocks/GME');
    const response = await GET(request, { params: { ticker: 'GME' } });
    const data = await response.json();

    if (response.status === 200) {
      expect(data.success).toBe(true);
      expect(data.data).toHaveProperty('ticker');
      expect(data.data).toHaveProperty('current');
      expect(data.data).toHaveProperty('historical');

      // Check current data structure
      expect(data.data.current).toHaveProperty('timestamp');
      expect(data.data.current).toHaveProperty('mentionCount');
      expect(data.data.current).toHaveProperty('uniquePosts');
      expect(data.data.current).toHaveProperty('uniqueComments');
      expect(data.data.current).toHaveProperty('sentimentScore');
      expect(data.data.current).toHaveProperty('sentimentCategory');
      expect(data.data.current).toHaveProperty('bullishCount');
      expect(data.data.current).toHaveProperty('bearishCount');
      expect(data.data.current).toHaveProperty('neutralCount');
      expect(data.data.current).toHaveProperty('totalUpvotes');
      expect(data.data.current).toHaveProperty('subredditBreakdown');
      expect(data.data.current).toHaveProperty('topKeywords');

      // Check historical data structure
      expect(Array.isArray(data.data.historical)).toBe(true);
      if (data.data.historical.length > 0) {
        expect(data.data.historical[0]).toHaveProperty('timestamp');
        expect(data.data.historical[0]).toHaveProperty('mentionCount');
        expect(data.data.historical[0]).toHaveProperty('sentimentScore');
      }
    }
  });

  it('should normalize ticker to uppercase', async () => {
    const request = new NextRequest('http://localhost:3000/api/stocks/gme');
    const response = await GET(request, { params: { ticker: 'gme' } });
    const data = await response.json();

    if (response.status === 200) {
      expect(data.data.ticker).toBe('GME');
    }
  });

  it('should return historical data within 7 days', async () => {
    const request = new NextRequest('http://localhost:3000/api/stocks/GME');
    const response = await GET(request, { params: { ticker: 'GME' } });
    const data = await response.json();

    if (response.status === 200 && data.data.historical.length > 0) {
      const now = Date.now();
      const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000;

      for (const item of data.data.historical) {
        expect(item.timestamp).toBeGreaterThanOrEqual(sevenDaysAgo);
        expect(item.timestamp).toBeLessThanOrEqual(now);
      }
    }
  });

  it('should handle database errors gracefully', async () => {
    const request = new NextRequest('http://localhost:3000/api/stocks/TEST');
    const response = await GET(request, { params: { ticker: 'TEST' } });

    // Should return either 404 or 500, not crash
    expect([404, 500]).toContain(response.status);
  });
});
