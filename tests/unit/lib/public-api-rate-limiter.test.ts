import { getClientIP } from '@/lib/public-api-rate-limiter';

function makeRequest(headers: Record<string, string>): Request {
  return { headers: new Headers(headers) } as unknown as Request;
}

describe('getClientIP', () => {
  it('returns the first IP from x-forwarded-for when present', () => {
    const req = makeRequest({ 'x-forwarded-for': '203.0.113.1, 10.0.0.1, 192.168.1.1' });
    expect(getClientIP(req)).toBe('203.0.113.1');
  });

  it('trims whitespace from x-forwarded-for IP', () => {
    const req = makeRequest({ 'x-forwarded-for': '  203.0.113.1  , 10.0.0.2' });
    expect(getClientIP(req)).toBe('203.0.113.1');
  });

  it('prefers x-forwarded-for over x-real-ip', () => {
    const req = makeRequest({
      'x-forwarded-for': '203.0.113.1',
      'x-real-ip': '203.0.113.99',
    });
    expect(getClientIP(req)).toBe('203.0.113.1');
  });

  it('falls back to x-real-ip when x-forwarded-for is absent', () => {
    const req = makeRequest({ 'x-real-ip': '198.51.100.5' });
    expect(getClientIP(req)).toBe('198.51.100.5');
  });

  it('returns "unknown" when neither header is present', () => {
    const req = makeRequest({});
    expect(getClientIP(req)).toBe('unknown');
  });

  it('handles a single IP in x-forwarded-for (no comma)', () => {
    const req = makeRequest({ 'x-forwarded-for': '1.2.3.4' });
    expect(getClientIP(req)).toBe('1.2.3.4');
  });
});
