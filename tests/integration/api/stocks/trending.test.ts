import { GET } from '@/app/api/stocks/trending/route';

describe('GET /api/stocks/trending', () => {
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
});
