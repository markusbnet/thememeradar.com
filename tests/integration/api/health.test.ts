import { GET } from '@/app/api/health/route';

describe('GET /api/health', () => {
  it('should return 200 with success status', async () => {
    const request = new Request('http://localhost:3000/api/health');
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
  });

  it('should return status "ok"', async () => {
    const request = new Request('http://localhost:3000/api/health');
    const response = await GET(request);
    const data = await response.json();

    expect(data.data.status).toBe('ok');
  });

  it('should return a timestamp', async () => {
    const before = Date.now();
    const request = new Request('http://localhost:3000/api/health');
    const response = await GET(request);
    const data = await response.json();
    const after = Date.now();

    expect(data.data.timestamp).toBeGreaterThanOrEqual(before);
    expect(data.data.timestamp).toBeLessThanOrEqual(after);
  });

  it('should match the standard response format', async () => {
    const request = new Request('http://localhost:3000/api/health');
    const response = await GET(request);
    const data = await response.json();

    expect(data).toEqual({
      success: true,
      data: {
        status: 'ok',
        timestamp: expect.any(Number),
      },
    });
  });
});
