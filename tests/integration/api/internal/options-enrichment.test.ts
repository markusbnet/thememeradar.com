/**
 * Integration tests for POST /api/internal/options-enrichment
 * DynamoDB PutCommand is mocked — no live DB required.
 */

jest.mock('@/lib/db/client', () => ({
  docClient: { send: jest.fn() },
  TABLES: { STOCK_OPTIONS: 'stock_options' },
  PutCommand: jest.fn().mockImplementation((input) => input),
}));

import { POST } from '@/app/api/internal/options-enrichment/route';
import { docClient } from '@/lib/db/client';
import fixture from '../../../fixtures/swaggystocks-sample.json';

const mockSend = docClient.send as jest.MockedFunction<typeof docClient.send>;

const INGEST_SECRET = 'test-options-ingest-secret-xyz';

function makeRequest(body: unknown, secret = INGEST_SECRET): Request {
  return new Request('http://localhost/api/internal/options-enrichment', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${secret}`,
    },
    body: JSON.stringify(body),
  });
}

describe('POST /api/internal/options-enrichment', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSend.mockResolvedValue({});
    process.env.OPTIONS_INGEST_SECRET = INGEST_SECRET;
  });

  afterEach(() => {
    delete process.env.OPTIONS_INGEST_SECRET;
  });

  describe('authentication', () => {
    it('returns 401 without Authorization header', async () => {
      const req = new Request('http://localhost/api/internal/options-enrichment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(fixture),
      });
      const response = await POST(req);
      expect(response.status).toBe(401);
    });

    it('returns 401 with wrong secret', async () => {
      const req = makeRequest(fixture, 'wrong-secret');
      const response = await POST(req);
      expect(response.status).toBe(401);
    });

    it('returns 401 when OPTIONS_INGEST_SECRET env var is not set', async () => {
      delete process.env.OPTIONS_INGEST_SECRET;
      const req = makeRequest(fixture);
      const response = await POST(req);
      expect(response.status).toBe(401);
    });
  });

  describe('payload validation', () => {
    it('returns 400 with empty body (no rows array)', async () => {
      const req = makeRequest({});
      const response = await POST(req);
      expect(response.status).toBe(400);
    });

    it('returns 400 when rows is not an array', async () => {
      const req = makeRequest({ rows: 'not-array' });
      const response = await POST(req);
      expect(response.status).toBe(400);
    });

    it('returns 400 when required field ticker is missing', async () => {
      const badRow = {
        timestamp: 1713600000000,
        callOpenInterest: 450000,
        putOpenInterest: 180000,
        putCallRatio: 0.40,
        iv30d: 0.85,
        fetchedAt: 1713600000000,
      };
      const req = makeRequest({ rows: [badRow] });
      const response = await POST(req);
      expect(response.status).toBe(400);
    });

    it('returns 400 when putCallRatio is a string (invalid type)', async () => {
      const badRow = {
        ticker: 'GME',
        timestamp: 1713600000000,
        callOpenInterest: 450000,
        putOpenInterest: 180000,
        putCallRatio: 'high',
        iv30d: 0.85,
        fetchedAt: 1713600000000,
      };
      const req = makeRequest({ rows: [badRow] });
      const response = await POST(req);
      expect(response.status).toBe(400);
    });

    it('returns 400 when callOpenInterest is missing', async () => {
      const badRow = {
        ticker: 'GME',
        timestamp: 1713600000000,
        putOpenInterest: 180000,
        putCallRatio: 0.40,
        iv30d: 0.85,
        fetchedAt: 1713600000000,
      };
      const req = makeRequest({ rows: [badRow] });
      const response = await POST(req);
      expect(response.status).toBe(400);
    });
  });

  describe('successful ingest', () => {
    it('returns 201 when fixture payload is valid', async () => {
      const req = makeRequest(fixture);
      const response = await POST(req);
      expect(response.status).toBe(201);
    });

    it('returns success=true in response body', async () => {
      const req = makeRequest(fixture);
      const response = await POST(req);
      const data = await response.json();
      expect(data.success).toBe(true);
    });

    it('returns correct count in response', async () => {
      const req = makeRequest(fixture);
      const response = await POST(req);
      const data = await response.json();
      expect(data.data.count).toBe(fixture.rows.length);
    });

    it('calls PutCommand exactly 5 times for fixture with 5 tickers', async () => {
      const req = makeRequest(fixture);
      await POST(req);
      expect(mockSend).toHaveBeenCalledTimes(5);
    });

    it('normalizes ticker to uppercase', async () => {
      const lowerCaseRow = {
        rows: [{
          ticker: 'gme',
          timestamp: 1713600000000,
          callOpenInterest: 450000,
          putOpenInterest: 180000,
          putCallRatio: 0.40,
          iv30d: 0.85,
          fetchedAt: 1713600000000,
        }],
      };
      const req = makeRequest(lowerCaseRow);
      await POST(req);
      const callArg = mockSend.mock.calls[0][0] as Record<string, unknown>;
      expect((callArg.Item as Record<string, unknown>).ticker).toBe('GME');
    });

    it('sets ttl field on stored item', async () => {
      const singleRow = {
        rows: [fixture.rows[0]],
      };
      const req = makeRequest(singleRow);
      await POST(req);
      const callArg = mockSend.mock.calls[0][0] as Record<string, unknown>;
      const item = callArg.Item as Record<string, unknown>;
      expect(typeof item.ttl).toBe('number');
      expect(item.ttl).toBeGreaterThan(0);
    });

    it('accepts row with iv30d=null', async () => {
      const birdRow = fixture.rows.find(r => r.ticker === 'BIRD')!;
      const req = makeRequest({ rows: [birdRow] });
      const response = await POST(req);
      expect(response.status).toBe(201);
    });
  });
});
