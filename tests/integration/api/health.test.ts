/**
 * Integration Tests for Health API Endpoint
 */

import { GET } from '@/app/api/health/route';

describe('GET /api/health', () => {
  it('should return health status', async () => {
    const response = await GET();
    const data = await response.json();

    expect(response.status).toBeOneOf([200, 503]);
    expect(data).toHaveProperty('status');
    expect(data).toHaveProperty('timestamp');
    expect(data).toHaveProperty('services');
    expect(data.services).toHaveProperty('database');
  });

  it('should have valid status values', async () => {
    const response = await GET();
    const data = await response.json();

    expect(['healthy', 'degraded', 'unhealthy']).toContain(data.status);
  });

  it('should have valid service status values', async () => {
    const response = await GET();
    const data = await response.json();

    expect(['ok', 'error']).toContain(data.services.database);
  });

  it('should return 200 when healthy', async () => {
    const response = await GET();
    const data = await response.json();

    if (data.status === 'healthy') {
      expect(response.status).toBe(200);
      expect(data.services.database).toBe('ok');
    }
  });

  it('should return 503 when unhealthy', async () => {
    const response = await GET();
    const data = await response.json();

    if (data.status === 'unhealthy') {
      expect(response.status).toBe(503);
      expect(data).toHaveProperty('error');
    }
  });

  it('should include timestamp', async () => {
    const before = Date.now();
    const response = await GET();
    const after = Date.now();
    const data = await response.json();

    expect(data.timestamp).toBeGreaterThanOrEqual(before);
    expect(data.timestamp).toBeLessThanOrEqual(after);
  });
});

// Custom matcher for toBeOneOf
expect.extend({
  toBeOneOf(received: unknown, expected: unknown[]) {
    const pass = expected.includes(received);
    return {
      pass,
      message: () =>
        pass
          ? `expected ${received} not to be one of ${expected.join(', ')}`
          : `expected ${received} to be one of ${expected.join(', ')}`,
    };
  },
});

declare global {
  namespace jest {
    interface Matchers<R> {
      toBeOneOf(expected: unknown[]): R;
    }
  }
}
