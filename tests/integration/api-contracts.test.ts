/**
 * API Contract Tests — every /api route has ≥3 assertions:
 *   happy path (status + success:true + shape), auth guard (401), validation (400)
 */

// ─── Mocks (must precede all imports) ─────────────────────────────────────────

jest.mock('@/lib/db/storage', () => ({
  getTrendingStocks: jest.fn().mockResolvedValue([]),
  getFadingStocks: jest.fn().mockResolvedValue([]),
  getSparklineData: jest.fn().mockResolvedValue([]),
  getStockDetails: jest.fn().mockResolvedValue({
    ticker: 'GME', mentionCount: 100, sentimentScore: 0.5, sentimentCategory: 'bullish',
    velocity: 50, timestamp: 1700000000000,
  }),
  getStockEvidence: jest.fn().mockResolvedValue([]),
  getStockHistory: jest.fn().mockResolvedValue([]),
  getStockTimeBreakdown: jest.fn().mockResolvedValue([]),
  saveScanResults: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('@/lib/db/users', () => ({
  getUserByEmail: jest.fn(),
  getUserById: jest.fn(),
  createUser: jest.fn(),
  deleteUserByEmail: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('@/lib/auth/password', () => ({
  verifyPassword: jest.fn(),
  hashPassword: jest.fn().mockResolvedValue('$2b$10$hashed'),
  validatePassword: jest.fn().mockReturnValue({ valid: true, errors: [] }),
}));

jest.mock('@/lib/auth/jwt', () => ({
  generateToken: jest.fn().mockReturnValue('mock.jwt.token'),
  verifyToken: jest.fn(),
}));

jest.mock('@/lib/db/enrichment', () => ({
  getEnrichmentMap: jest.fn().mockResolvedValue(new Map()),
  getLatestEnrichment: jest.fn().mockResolvedValue(null),
}));

jest.mock('@/lib/db/prices', () => ({
  getLatestPriceMap: jest.fn().mockResolvedValue(new Map()),
  getLatestPriceSnapshot: jest.fn().mockResolvedValue(null),
  getLatestPrice: jest.fn().mockResolvedValue(null),
  getPriceHistory: jest.fn().mockResolvedValue([]),
}));

jest.mock('@/lib/db/apewisdom', () => ({
  getLatestApewisdomSnapshot: jest.fn().mockResolvedValue(null),
}));

jest.mock('@/lib/coverage/apewisdom', () => ({
  mergeCoverage: jest.fn().mockImplementation((ours: unknown[]) => ours),
}));

jest.mock('@/lib/db/surge', () => ({
  getSurgingStocks: jest.fn().mockResolvedValue([]),
}));

jest.mock('@/lib/opportunity-score', () => ({
  getOpportunities: jest.fn().mockResolvedValue([]),
}));

jest.mock('@/lib/db/alerts', () => ({
  getPendingAlerts: jest.fn().mockResolvedValue([]),
  saveAlert: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('@/lib/market/swaggystocks', () => ({
  getLatestOptionsActivity: jest.fn().mockResolvedValue(null),
}));

jest.mock('@/lib/scanner/scanner', () => ({
  createScanner: () => ({
    scanMultipleSubreddits: jest.fn().mockResolvedValue([]),
  }),
}));

jest.mock('@/lib/lunarcrush', () => ({
  enrichWithLunarCrush: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('@/lib/market/finnhub', () => ({
  enrichWithPrices: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('@/lib/alert-pipeline', () => ({
  checkAndCreateAlerts: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('@/lib/db/scan-lock', () => ({
  acquireScanLock: jest.fn().mockResolvedValue('lock-id'),
  releaseScanLock: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('@/lib/db/scan-heartbeat', () => ({
  recordScanStarted: jest.fn().mockResolvedValue(undefined),
  recordScanSuccess: jest.fn().mockResolvedValue(undefined),
  recordScanFailed: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('@/lib/scan-failure-alert', () => ({
  recordScanFailureAlert: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('@/lib/scan-config', () => ({
  parseSubredditList: jest.fn().mockReturnValue(['wallstreetbets']),
}));

jest.mock('@/lib/cache', () => ({
  apiCache: {
    get: jest.fn().mockReturnValue(undefined),
    set: jest.fn(),
    clear: jest.fn(),
  },
}));

jest.mock('@/lib/rate-limit', () => ({
  authRateLimiter: {
    check: jest.fn().mockReturnValue({ allowed: true, remaining: 999, retryAfterMs: 0 }),
    reset: jest.fn(),
  },
}));

// ─── Imports ──────────────────────────────────────────────────────────────────

import { GET as healthGET } from '@/app/api/health/route';
import { POST as signupPOST } from '@/app/api/auth/signup/route';
import { POST as loginPOST } from '@/app/api/auth/login/route';
import { POST as logoutPOST } from '@/app/api/auth/logout/route';
import { GET as meGET } from '@/app/api/auth/me/route';
import { GET as trendingGET } from '@/app/api/stocks/trending/route';
import { GET as surgingGET } from '@/app/api/stocks/surging/route';
import { GET as opportunitiesGET } from '@/app/api/stocks/opportunities/route';
import { GET as tickerGET } from '@/app/api/stocks/[ticker]/route';
import { GET as evidenceGET } from '@/app/api/stocks/[ticker]/evidence/route';
import { GET as pendingAlertsGET } from '@/app/api/internal/pending-alerts/route';

import { getUserByEmail, getUserById, createUser } from '@/lib/db/users';
import { verifyPassword } from '@/lib/auth/password';
import { verifyToken } from '@/lib/auth/jwt';

const mockGetUserByEmail = getUserByEmail as jest.MockedFunction<typeof getUserByEmail>;
const mockGetUserById = getUserById as jest.MockedFunction<typeof getUserById>;
const mockCreateUser = createUser as jest.MockedFunction<typeof createUser>;
const mockVerifyPassword = verifyPassword as jest.MockedFunction<typeof verifyPassword>;
const mockVerifyToken = verifyToken as jest.MockedFunction<typeof verifyToken>;

// ─── Test setup ───────────────────────────────────────────────────────────────

const CRON_SECRET = 'test-cron-secret';
const ALERTS_SECRET = 'test-alerts-secret';
const OPTIONS_SECRET = 'test-options-secret';
const APEWISDOM_SECRET = 'test-apewisdom-secret';

beforeAll(() => {
  process.env.CRON_SECRET = CRON_SECRET;
  process.env.ALERTS_API_SECRET = ALERTS_SECRET;
  process.env.OPTIONS_INGEST_SECRET = OPTIONS_SECRET;
  process.env.APEWISDOM_INGEST_SECRET = APEWISDOM_SECRET;
  process.env.JWT_SECRET = 'test-jwt-secret';
  process.env.SESSION_COOKIE_NAME = 'meme_radar_session';
  process.env.REDDIT_CLIENT_ID = 'test-reddit-id';
  process.env.REDDIT_CLIENT_SECRET = 'test-reddit-secret';
});

function req(url: string, options?: RequestInit): Request {
  return new Request(`http://localhost:3000${url}`, options);
}

function jsonReq(url: string, body: unknown, extra?: RequestInit): Request {
  return new Request(`http://localhost:3000${url}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(extra?.headers ?? {}) },
    body: JSON.stringify(body),
    ...extra,
  });
}

function withCookie(url: string, name: string, value: string): Request {
  const r = new Request(`http://localhost:3000${url}`, {
    headers: { Cookie: `${name}=${value}` },
  });
  // Polyfill NextRequest.cookies for Jest (NextRequest parses Cookie header at runtime,
  // but plain Request used in Jest doesn't expose the .cookies property)
  (r as Record<string, unknown>).cookies = {
    get: (cookieName: string) => {
      const match = `${name}=${value}`.match(new RegExp(`${cookieName}=([^;]+)`));
      return match ? { value: match[1] } : undefined;
    },
  };
  return r;
}

const mockUser = {
  userId: 'user-123',
  email: 'contract@test.com',
  passwordHash: '$2b$10$hashed',
  createdAt: 1700000000000,
  lastLoginAt: 1700000000000,
};

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('API Contract Tests', () => {
  // ── GET /api/health ─────────────────────────────────────────────────────────
  describe('GET /api/health', () => {
    it('returns 200 with success:true', async () => {
      const res = await healthGET(req('/api/health') as Parameters<typeof healthGET>[0]);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
    });

    it('response data has a status field', async () => {
      const res = await healthGET(req('/api/health') as Parameters<typeof healthGET>[0]);
      const data = await res.json();
      expect(data.data).toHaveProperty('status');
    });
  });

  // ── POST /api/auth/signup ───────────────────────────────────────────────────
  describe('POST /api/auth/signup', () => {
    beforeEach(() => {
      mockCreateUser.mockResolvedValue(mockUser);
    });

    it('returns 201 with success:true on valid input', async () => {
      const res = await signupPOST(jsonReq('/api/auth/signup', {
        email: 'new@example.com',
        password: 'ValidPass1!',
      }) as Parameters<typeof signupPOST>[0]);
      expect(res.status).toBe(201);
      const data = await res.json();
      expect(data.success).toBe(true);
    });

    it('returns 400 with error for invalid email', async () => {
      const res = await signupPOST(jsonReq('/api/auth/signup', {
        email: 'not-an-email',
        password: 'ValidPass1!',
      }) as Parameters<typeof signupPOST>[0]);
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.success).toBe(false);
      expect(data.error).toBeTruthy();
    });

    it('returns 400 with error for missing email', async () => {
      const res = await signupPOST(jsonReq('/api/auth/signup', {
        password: 'ValidPass1!',
      }) as Parameters<typeof signupPOST>[0]);
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.success).toBe(false);
    });

    it('returns 409 for duplicate email', async () => {
      mockCreateUser.mockRejectedValueOnce(new Error('Email already registered'));
      const res = await signupPOST(jsonReq('/api/auth/signup', {
        email: 'dup@example.com',
        password: 'ValidPass1!',
      }) as Parameters<typeof signupPOST>[0]);
      expect(res.status).toBe(409);
      const data = await res.json();
      expect(data.success).toBe(false);
    });
  });

  // ── POST /api/auth/login ────────────────────────────────────────────────────
  describe('POST /api/auth/login', () => {
    it('returns 200 with token on valid credentials', async () => {
      mockGetUserByEmail.mockResolvedValue(mockUser);
      mockVerifyPassword.mockResolvedValue(true);

      const res = await loginPOST(jsonReq('/api/auth/login', {
        email: 'contract@test.com',
        password: 'ValidPass1!',
      }) as Parameters<typeof loginPOST>[0]);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.data.token).toBeDefined();
    });

    it('returns 401 for wrong password', async () => {
      mockGetUserByEmail.mockResolvedValue(mockUser);
      mockVerifyPassword.mockResolvedValue(false);

      const res = await loginPOST(jsonReq('/api/auth/login', {
        email: 'contract@test.com',
        password: 'WrongPass99!',
      }) as Parameters<typeof loginPOST>[0]);
      expect(res.status).toBe(401);
      const data = await res.json();
      expect(data.success).toBe(false);
      expect(data.error).toBeTruthy();
    });

    it('returns 400 for missing password field', async () => {
      const res = await loginPOST(jsonReq('/api/auth/login', {
        email: 'contract@test.com',
      }) as Parameters<typeof loginPOST>[0]);
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.success).toBe(false);
    });
  });

  // ── POST /api/auth/logout ───────────────────────────────────────────────────
  describe('POST /api/auth/logout', () => {
    it('returns 200 with success:true', async () => {
      const res = await logoutPOST(req('/api/auth/logout', { method: 'POST' }) as Parameters<typeof logoutPOST>[0]);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
    });

    it('sets cookie to empty value (clears session)', async () => {
      const res = await logoutPOST(req('/api/auth/logout', { method: 'POST' }) as Parameters<typeof logoutPOST>[0]);
      const cookieHeader = res.headers.get('set-cookie');
      expect(cookieHeader).toMatch(/meme_radar_session=/);
    });
  });

  // ── GET /api/auth/me ────────────────────────────────────────────────────────
  describe('GET /api/auth/me', () => {
    it('returns 200 with user data when authenticated', async () => {
      mockVerifyToken.mockReturnValue({ userId: 'user-123' });
      mockGetUserById.mockResolvedValue(mockUser);

      const r = withCookie('/api/auth/me', 'meme_radar_session', 'valid.token');
      const res = await meGET(r as Parameters<typeof meGET>[0]);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.user.userId).toBe('user-123');
      expect(data.user).not.toHaveProperty('passwordHash');
    });

    it('returns 401 when no cookie present', async () => {
      const r = new Request('http://localhost:3000/api/auth/me');
      // Polyfill .cookies to simulate NextRequest with no cookie set
      (r as Record<string, unknown>).cookies = { get: () => undefined };
      const res = await meGET(r as Parameters<typeof meGET>[0]);
      expect(res.status).toBe(401);
      const data = await res.json();
      expect(data.success).toBe(false);
    });

    it('returns 401 for invalid token', async () => {
      mockVerifyToken.mockReturnValue(null);
      const r = withCookie('/api/auth/me', 'meme_radar_session', 'bad.token');
      const res = await meGET(r as Parameters<typeof meGET>[0]);
      expect(res.status).toBe(401);
    });
  });

  // ── GET /api/stocks/trending ────────────────────────────────────────────────
  describe('GET /api/stocks/trending', () => {
    it('returns 200 with trending and fading arrays', async () => {
      const res = await trendingGET(req('/api/stocks/trending') as Parameters<typeof trendingGET>[0]);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(Array.isArray(data.data.trending)).toBe(true);
      expect(Array.isArray(data.data.fading)).toBe(true);
    });

    it('accepts valid ?timeframe= param and returns 200', async () => {
      const res = await trendingGET(req('/api/stocks/trending?timeframe=1h') as Parameters<typeof trendingGET>[0]);
      expect(res.status).toBe(200);
    });

    it('returns 400 for invalid ?timeframe= param', async () => {
      const res = await trendingGET(req('/api/stocks/trending?timeframe=invalid') as Parameters<typeof trendingGET>[0]);
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.success).toBe(false);
    });
  });

  // ── GET /api/stocks/surging ─────────────────────────────────────────────────
  describe('GET /api/stocks/surging', () => {
    it('returns 200 with surging array nested in data', async () => {
      const res = await surgingGET(req('/api/stocks/surging') as Parameters<typeof surgingGET>[0]);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(Array.isArray(data.data.surging)).toBe(true);
    });
  });

  // ── GET /api/stocks/opportunities ──────────────────────────────────────────
  describe('GET /api/stocks/opportunities', () => {
    it('returns 200 with opportunities array nested in data', async () => {
      const res = await opportunitiesGET(req('/api/stocks/opportunities') as Parameters<typeof opportunitiesGET>[0]);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(Array.isArray(data.data.opportunities)).toBe(true);
    });
  });

  // ── GET /api/stocks/:ticker ─────────────────────────────────────────────────
  describe('GET /api/stocks/:ticker', () => {
    it('returns 200 with ticker data when stock exists', async () => {
      const params = Promise.resolve({ ticker: 'GME' });
      const res = await tickerGET(req('/api/stocks/GME') as Parameters<typeof tickerGET>[0], { params });
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.data).toHaveProperty('ticker');
    });

    it('returns 404 when stock not found', async () => {
      const { getStockDetails } = await import('@/lib/db/storage');
      (getStockDetails as jest.Mock).mockResolvedValueOnce(null);
      const params = Promise.resolve({ ticker: 'UNKN' });
      const res = await tickerGET(req('/api/stocks/UNKN') as Parameters<typeof tickerGET>[0], { params });
      expect(res.status).toBe(404);
      const data = await res.json();
      expect(data.success).toBe(false);
    });

    it('response data includes ticker field', async () => {
      const params = Promise.resolve({ ticker: 'AMC' });
      const res = await tickerGET(req('/api/stocks/AMC') as Parameters<typeof tickerGET>[0], { params });
      const data = await res.json();
      expect(data.data.ticker).toBe('AMC');
    });
  });

  // ── GET /api/stocks/:ticker/evidence ───────────────────────────────────────
  describe('GET /api/stocks/:ticker/evidence', () => {
    it('returns 200 with evidence object containing array', async () => {
      const params = Promise.resolve({ ticker: 'GME' });
      const res = await evidenceGET(req('/api/stocks/GME/evidence') as Parameters<typeof evidenceGET>[0], { params });
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(Array.isArray(data.data.evidence)).toBe(true);
      expect(data.data).toHaveProperty('count');
    });
  });

  // ── POST /api/scan ──────────────────────────────────────────────────────────
  describe('POST /api/scan', () => {
    it('returns 401 when Authorization header is missing', async () => {
      const { POST } = await import('@/app/api/scan/route');
      const res = await POST(jsonReq('/api/scan', { subreddits: ['wallstreetbets'] }) as Parameters<typeof POST>[0]);
      expect(res.status).toBe(401);
      const data = await res.json();
      expect(data.success).toBe(false);
    });

    it('returns 401 for wrong Bearer secret', async () => {
      const { POST } = await import('@/app/api/scan/route');
      const res = await POST(jsonReq('/api/scan', { subreddits: ['wallstreetbets'] }, {
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer wrong-secret' },
      }) as Parameters<typeof POST>[0]);
      expect(res.status).toBe(401);
    });

    it('returns 200 with valid auth and subreddits array', async () => {
      const { POST } = await import('@/app/api/scan/route');
      const res = await POST(jsonReq('/api/scan', { subreddits: ['wallstreetbets'] }, {
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${CRON_SECRET}` },
      }) as Parameters<typeof POST>[0]);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
    });
  });

  // ── GET /api/internal/pending-alerts ───────────────────────────────────────
  describe('GET /api/internal/pending-alerts', () => {
    it('returns 200 with alerts array when authenticated', async () => {
      const res = await pendingAlertsGET(req('/api/internal/pending-alerts', {
        headers: { Authorization: `Bearer ${ALERTS_SECRET}` },
      }));
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(Array.isArray(data.data)).toBe(true);
    });

    it('returns 401 when Authorization header is missing', async () => {
      const res = await pendingAlertsGET(req('/api/internal/pending-alerts'));
      expect(res.status).toBe(401);
      const data = await res.json();
      expect(data.success).toBe(false);
    });

    it('returns 401 for wrong Bearer secret', async () => {
      const res = await pendingAlertsGET(req('/api/internal/pending-alerts', {
        headers: { Authorization: 'Bearer wrong-secret' },
      }));
      expect(res.status).toBe(401);
    });
  });

  // ── POST /api/internal/options-enrichment ──────────────────────────────────
  describe('POST /api/internal/options-enrichment', () => {
    it('returns 401 without auth', async () => {
      const { POST } = await import('@/app/api/internal/options-enrichment/route');
      const res = await POST(jsonReq('/api/internal/options-enrichment', { rows: [] }) as Parameters<typeof POST>[0]);
      expect(res.status).toBe(401);
      const data = await res.json();
      expect(data.success).toBe(false);
    });

    it('returns 400 for missing rows field', async () => {
      const { POST } = await import('@/app/api/internal/options-enrichment/route');
      const res = await POST(jsonReq('/api/internal/options-enrichment', {}, {
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${OPTIONS_SECRET}` },
      }) as Parameters<typeof POST>[0]);
      expect(res.status).toBe(400);
    });
  });

  // ── POST /api/internal/apewisdom-ingest ────────────────────────────────────
  describe('POST /api/internal/apewisdom-ingest', () => {
    it('returns 401 without auth', async () => {
      const { POST } = await import('@/app/api/internal/apewisdom-ingest/route');
      const res = await POST(jsonReq('/api/internal/apewisdom-ingest', { subreddit: 'wallstreetbets', rows: [], fetchedAt: Date.now() }) as Parameters<typeof POST>[0]);
      expect(res.status).toBe(401);
      const data = await res.json();
      expect(data.success).toBe(false);
    });

    it('returns 400 for missing required fields', async () => {
      const { POST } = await import('@/app/api/internal/apewisdom-ingest/route');
      const res = await POST(jsonReq('/api/internal/apewisdom-ingest', {}, {
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${APEWISDOM_SECRET}` },
      }) as Parameters<typeof POST>[0]);
      expect(res.status).toBe(400);
    });
  });
});
