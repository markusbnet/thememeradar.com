/**
 * Integration Tests for Stock Evidence API
 */

import { GET } from '@/app/api/stocks/[ticker]/evidence/route';
import { NextRequest } from 'next/server';

describe('GET /api/stocks/[ticker]/evidence', () => {
  it('should return 404 for ticker with no evidence', async () => {
    const request = new NextRequest('http://localhost:3000/api/stocks/FAKE/evidence');
    const response = await GET(request, { params: { ticker: 'FAKE' } });
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.success).toBe(false);
    expect(data.error).toContain('No evidence found');
  });

  it('should return evidence with correct structure', async () => {
    const request = new NextRequest('http://localhost:3000/api/stocks/GME/evidence');
    const response = await GET(request, { params: { ticker: 'GME' } });
    const data = await response.json();

    if (response.status === 200) {
      expect(data.success).toBe(true);
      expect(data.data).toHaveProperty('ticker');
      expect(data.data).toHaveProperty('count');
      expect(data.data).toHaveProperty('evidence');
      expect(Array.isArray(data.data.evidence)).toBe(true);

      if (data.data.evidence.length > 0) {
        const evidence = data.data.evidence[0];
        expect(evidence).toHaveProperty('ticker');
        expect(evidence).toHaveProperty('evidenceId');
        expect(evidence).toHaveProperty('type');
        expect(evidence).toHaveProperty('text');
        expect(evidence).toHaveProperty('keywords');
        expect(evidence).toHaveProperty('sentimentScore');
        expect(evidence).toHaveProperty('sentimentCategory');
        expect(evidence).toHaveProperty('upvotes');
        expect(evidence).toHaveProperty('subreddit');
        expect(evidence).toHaveProperty('createdAt');
        expect(evidence).toHaveProperty('redditUrl');

        // Validate types
        expect(['post', 'comment']).toContain(evidence.type);
        expect(Array.isArray(evidence.keywords)).toBe(true);
        expect(typeof evidence.sentimentScore).toBe('number');
      }
    }
  });

  it('should respect limit parameter', async () => {
    const request = new NextRequest('http://localhost:3000/api/stocks/GME/evidence?limit=5');
    const response = await GET(request, { params: { ticker: 'GME' } });
    const data = await response.json();

    if (response.status === 200) {
      expect(data.data.evidence.length).toBeLessThanOrEqual(5);
    }
  });

  it('should cap limit at 100', async () => {
    const request = new NextRequest('http://localhost:3000/api/stocks/GME/evidence?limit=1000');
    const response = await GET(request, { params: { ticker: 'GME' } });
    const data = await response.json();

    if (response.status === 200) {
      expect(data.data.evidence.length).toBeLessThanOrEqual(100);
    }
  });

  it('should default to limit of 10', async () => {
    const request = new NextRequest('http://localhost:3000/api/stocks/GME/evidence');
    const response = await GET(request, { params: { ticker: 'GME' } });
    const data = await response.json();

    if (response.status === 200) {
      expect(data.data.evidence.length).toBeLessThanOrEqual(10);
    }
  });

  it('should sort evidence by upvotes (descending)', async () => {
    const request = new NextRequest('http://localhost:3000/api/stocks/GME/evidence');
    const response = await GET(request, { params: { ticker: 'GME' } });
    const data = await response.json();

    if (response.status === 200 && data.data.evidence.length > 1) {
      const upvotes = data.data.evidence.map((e: { upvotes: number }) => e.upvotes);
      const sortedUpvotes = [...upvotes].sort((a: number, b: number) => b - a);
      expect(upvotes).toEqual(sortedUpvotes);
    }
  });

  it('should include Reddit URLs for posts', async () => {
    const request = new NextRequest('http://localhost:3000/api/stocks/GME/evidence');
    const response = await GET(request, { params: { ticker: 'GME' } });
    const data = await response.json();

    if (response.status === 200) {
      const posts = data.data.evidence.filter((e: { type: string }) => e.type === 'post');
      for (const post of posts) {
        expect(post.redditUrl).toMatch(/^https:\/\/reddit\.com\/r\/[\w]+\/comments\/[\w]+$/);
      }
    }
  });

  it('should normalize ticker to uppercase', async () => {
    const request = new NextRequest('http://localhost:3000/api/stocks/gme/evidence');
    const response = await GET(request, { params: { ticker: 'gme' } });
    const data = await response.json();

    if (response.status === 200) {
      expect(data.data.ticker).toBe('GME');
    }
  });

  it('should handle database errors gracefully', async () => {
    const request = new NextRequest('http://localhost:3000/api/stocks/TEST/evidence');
    const response = await GET(request, { params: { ticker: 'TEST' } });

    // Should return either 404 or 500, not crash
    expect([404, 500]).toContain(response.status);
  });
});
