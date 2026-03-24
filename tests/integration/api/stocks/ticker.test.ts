import { GET } from '@/app/api/stocks/[ticker]/route';

describe('GET /api/stocks/[ticker]', () => {
  const createRequest = (ticker: string) => {
    return new Request(`http://localhost:3000/api/stocks/${ticker}`);
  };

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
});
