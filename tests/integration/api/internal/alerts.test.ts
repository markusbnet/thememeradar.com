/**
 * Integration tests for:
 *   GET  /api/internal/pending-alerts
 *   POST /api/internal/pending-alerts/[ticker]/sent
 *
 * DynamoDB calls are mocked so these tests run without DynamoDB Local.
 */

const ALERTS_SECRET = 'test-alerts-secret-xyz';

// ─── mock db/alerts module ─────────────────────────────────────────────────
jest.mock('@/lib/db/alerts', () => ({
  getPendingAlerts: jest.fn(),
  markAlertSent: jest.fn(),
}));

import { GET } from '@/app/api/internal/pending-alerts/route';
import { POST } from '@/app/api/internal/pending-alerts/[ticker]/route';
import { getPendingAlerts, markAlertSent } from '@/lib/db/alerts';
import type { StoredAlert } from '@/lib/db/alerts';

const mockGetPendingAlerts = getPendingAlerts as jest.MockedFunction<typeof getPendingAlerts>;
const mockMarkAlertSent = markAlertSent as jest.MockedFunction<typeof markAlertSent>;

function makeGetRequest(secret?: string) {
  return new Request('http://localhost/api/internal/pending-alerts', {
    method: 'GET',
    headers: secret ? { Authorization: `Bearer ${secret}` } : {},
  });
}

function makePostRequest(ticker: string, body: unknown, secret?: string) {
  return new Request(
    `http://localhost/api/internal/pending-alerts/${ticker}/sent`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(secret ? { Authorization: `Bearer ${secret}` } : {}),
      },
      body: JSON.stringify(body),
    }
  );
}

const sampleAlert: StoredAlert = {
  ticker: 'GME',
  createdAt: 1700000000000,
  opportunityScore: 82,
  subScores: {
    velocity: 80,
    sentiment: 70,
    socialDominance: 60,
    volumeChange: 90,
    creatorInfluence: 50,
  },
  emailSubject: '🔥 Meme Radar: $GME is showing strong buy signals',
  emailBody: 'Test body',
  sentAt: null,
  ttl: 1700086400,
};

describe('GET /api/internal/pending-alerts', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.ALERTS_API_SECRET = ALERTS_SECRET;
  });

  afterEach(() => {
    delete process.env.ALERTS_API_SECRET;
  });

  it('returns 401 without Authorization header', async () => {
    const response = await GET(makeGetRequest());
    expect(response.status).toBe(401);
  });

  it('returns 401 with wrong secret', async () => {
    const response = await GET(makeGetRequest('wrong-secret'));
    expect(response.status).toBe(401);
  });

  it('returns 401 when ALERTS_API_SECRET env var is not set', async () => {
    delete process.env.ALERTS_API_SECRET;
    const response = await GET(makeGetRequest(ALERTS_SECRET));
    expect(response.status).toBe(401);
  });

  it('returns 200 with empty array when no pending alerts', async () => {
    mockGetPendingAlerts.mockResolvedValue([]);

    const response = await GET(makeGetRequest(ALERTS_SECRET));
    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body.success).toBe(true);
    expect(body.data).toEqual([]);
  });

  it('returns 200 with pending alerts when they exist', async () => {
    mockGetPendingAlerts.mockResolvedValue([sampleAlert]);

    const response = await GET(makeGetRequest(ALERTS_SECRET));
    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body.success).toBe(true);
    expect(body.data).toHaveLength(1);
    expect(body.data[0].ticker).toBe('GME');
  });
});

describe('POST /api/internal/pending-alerts/[ticker]/sent', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.ALERTS_API_SECRET = ALERTS_SECRET;
  });

  afterEach(() => {
    delete process.env.ALERTS_API_SECRET;
  });

  it('returns 401 without Authorization header', async () => {
    const response = await POST(makePostRequest('GME', { createdAt: 1700000000000 }), {
      params: Promise.resolve({ ticker: 'GME' }),
    });
    expect(response.status).toBe(401);
  });

  it('returns 401 with wrong secret', async () => {
    const response = await POST(makePostRequest('GME', { createdAt: 1700000000000 }, 'wrong'), {
      params: Promise.resolve({ ticker: 'GME' }),
    });
    expect(response.status).toBe(401);
  });

  it('returns 404 when alert not found (markAlertSent returns false)', async () => {
    mockMarkAlertSent.mockResolvedValue(false);

    const response = await POST(
      makePostRequest('GME', { createdAt: 1700000000000 }, ALERTS_SECRET),
      { params: Promise.resolve({ ticker: 'GME' }) }
    );
    expect(response.status).toBe(404);
  });

  it('returns 200 when alert exists and markAlertSent returns true', async () => {
    mockMarkAlertSent.mockResolvedValue(true);

    const response = await POST(
      makePostRequest('GME', { createdAt: 1700000000000 }, ALERTS_SECRET),
      { params: Promise.resolve({ ticker: 'GME' }) }
    );
    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body.success).toBe(true);
  });

  it('returns 400 when createdAt is missing from request body', async () => {
    const response = await POST(
      makePostRequest('GME', {}, ALERTS_SECRET),
      { params: Promise.resolve({ ticker: 'GME' }) }
    );
    expect(response.status).toBe(400);
  });
});
