import { GET } from '@/app/api/stocks/surging/route';

describe('GET /api/stocks/surging', () => {
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
});
