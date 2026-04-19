/**
 * Integration tests for POST /api/internal/apewisdom-ingest
 */

jest.mock('@/lib/db/apewisdom', () => ({
  saveApewisdomSnapshot: jest.fn().mockResolvedValue(undefined),
}));

import { POST } from '@/app/api/internal/apewisdom-ingest/route';
import { saveApewisdomSnapshot } from '@/lib/db/apewisdom';
import fixture from '../../../fixtures/apewisdom-wsb-sample.json';

const mockSave = saveApewisdomSnapshot as jest.MockedFunction<typeof saveApewisdomSnapshot>;

const INGEST_SECRET = 'test-ingest-secret-xyz';

function makeRequest(body: unknown, secret = INGEST_SECRET) {
  return new Request('http://localhost/api/internal/apewisdom-ingest', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${secret}`,
    },
    body: JSON.stringify(body),
  });
}

describe('POST /api/internal/apewisdom-ingest', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.APEWISDOM_INGEST_SECRET = INGEST_SECRET;
  });

  afterEach(() => {
    delete process.env.APEWISDOM_INGEST_SECRET;
  });

  describe('authentication', () => {
    it('returns 401 when Authorization header is missing', async () => {
      const req = new Request('http://localhost/api/internal/apewisdom-ingest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(fixture),
      });
      const response = await POST(req);
      expect(response.status).toBe(401);
    });

    it('returns 401 when secret is wrong', async () => {
      const req = makeRequest(fixture, 'wrong-secret');
      const response = await POST(req);
      expect(response.status).toBe(401);
    });

    it('returns 401 when APEWISDOM_INGEST_SECRET env var is not set', async () => {
      delete process.env.APEWISDOM_INGEST_SECRET;
      const req = makeRequest(fixture);
      const response = await POST(req);
      expect(response.status).toBe(401);
    });
  });

  describe('payload validation', () => {
    it('returns 400 when subreddit is missing', async () => {
      const { subreddit: _omitted, ...bad } = fixture;
      const req = makeRequest(bad);
      const response = await POST(req);
      expect(response.status).toBe(400);
    });

    it('returns 400 when rows is not an array', async () => {
      const req = makeRequest({ ...fixture, rows: 'not-array' });
      const response = await POST(req);
      expect(response.status).toBe(400);
    });

    it('returns 400 when a row has missing fields', async () => {
      const badRow = { rank: 1, ticker: 'GME' }; // missing required fields
      const req = makeRequest({ ...fixture, rows: [badRow] });
      const response = await POST(req);
      expect(response.status).toBe(400);
    });
  });

  describe('successful ingest', () => {
    it('returns 200 and saves snapshot for valid payload', async () => {
      const req = makeRequest(fixture);
      const response = await POST(req);
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.success).toBe(true);
    });

    it('calls saveApewisdomSnapshot with parsed snapshot', async () => {
      const req = makeRequest(fixture);
      await POST(req);
      expect(mockSave).toHaveBeenCalledTimes(1);
      expect(mockSave).toHaveBeenCalledWith(
        expect.objectContaining({ subreddit: 'wallstreetbets', rows: expect.any(Array) })
      );
    });

    it('saves exactly the fixture rows count', async () => {
      const req = makeRequest(fixture);
      await POST(req);
      const saved = mockSave.mock.calls[0][0];
      expect(saved.rows).toHaveLength(fixture.rows.length);
    });
  });
});
