import { render, screen, waitFor, act } from '@testing-library/react';
import DashboardPage from '@/app/dashboard/page';

// Mock next/navigation. The real useRouter returns a stable object across
// renders; returning a fresh object each call would cause any
// `useEffect([router])` to re-run on every re-render, which produces
// phantom extra fetches in tests that rely on counting fetch calls.
const mockPush = jest.fn();
const mockRouter = { push: mockPush };
jest.mock('next/navigation', () => ({
  useRouter: () => mockRouter,
}));

// Mock auth client
const mockCheckAuth = jest.fn();
const mockLogout = jest.fn();
jest.mock('@/lib/auth/client', () => ({
  checkAuth: (...args: unknown[]) => mockCheckAuth(...args),
  logout: (...args: unknown[]) => mockLogout(...args),
}));

// Mock child components as simple stubs
jest.mock('@/components/StockCard', () => {
  return function MockStockCard({ ticker, type }: { ticker: string; type: string }) {
    return <div data-testid={`stock-card-${ticker}`}>StockCard: {ticker} ({type})</div>;
  };
});

jest.mock('@/components/OpportunityCard', () => {
  return function MockOpportunityCard({ opportunity, rank }: { opportunity: { ticker: string; signalLevel: string; score: number }; rank: number }) {
    return <div data-testid={`opp-card-${opportunity.ticker}`}>OpportunityCard: {opportunity.ticker} #{rank} ({opportunity.signalLevel}: {opportunity.score})</div>;
  };
});

jest.mock('@/components/SurgeAlert', () => {
  return function MockSurgeAlert({ stocks }: { stocks: unknown[] }) {
    return <div data-testid="surge-alert">SurgeAlert: {stocks.length} stocks</div>;
  };
});

jest.mock('@/components/RefreshTimer', () => {
  return function MockRefreshTimer({ onRefresh }: { onRefresh?: () => void | Promise<void> }) {
    return (
      <div data-testid="refresh-timer">
        <button
          type="button"
          onClick={() => {
            if (onRefresh) void onRefresh();
          }}
        >
          Refresh
        </button>
      </div>
    );
  };
});

// Helper to build a mock fetch that responds to trending, surging, and opportunities endpoints
function createMockFetch(overrides: {
  trending?: { success: boolean; data?: unknown; error?: string };
  surging?: { success: boolean; data?: unknown; error?: string };
  opportunities?: { success: boolean; data?: unknown; error?: string };
} = {}) {
  const trendingResponse = overrides.trending ?? {
    success: true,
    data: { trending: [], fading: [], timestamp: Date.now() },
  };
  const surgingResponse = overrides.surging ?? {
    success: true,
    data: { surging: [] },
  };
  const opportunitiesResponse = overrides.opportunities ?? {
    success: true,
    data: { opportunities: [] },
  };

  return jest.fn((url: string) => {
    if (url.startsWith('/api/stocks/trending')) {
      return Promise.resolve({
        ok: trendingResponse.success,
        json: () => Promise.resolve(trendingResponse),
      });
    }
    if (url === '/api/stocks/surging') {
      return Promise.resolve({
        ok: surgingResponse.success,
        json: () => Promise.resolve(surgingResponse),
      });
    }
    if (url === '/api/stocks/opportunities') {
      return Promise.resolve({
        ok: opportunitiesResponse.success,
        json: () => Promise.resolve(opportunitiesResponse),
      });
    }
    if (url === '/api/auth/logout') {
      return Promise.resolve({ ok: true, json: () => Promise.resolve({ success: true }) });
    }
    return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
  });
}

describe('DashboardPage', () => {
  beforeEach(() => {
    mockPush.mockClear();
    mockCheckAuth.mockClear();
    mockLogout.mockClear();
    // Default: authenticated user
    mockCheckAuth.mockResolvedValue({
      authenticated: true,
      user: { userId: 'u1', email: 'test@example.com', createdAt: 1000 },
    });
    mockLogout.mockResolvedValue(true);
    global.fetch = createMockFetch() as unknown as typeof fetch;
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('shows loading spinner initially', () => {
    // Make checkAuth hang so loading state persists
    mockCheckAuth.mockReturnValue(new Promise(() => {}));
    render(<DashboardPage />);

    expect(screen.getByText('Loading...')).toBeInTheDocument();
  });

  it('redirects to /login when not authenticated', async () => {
    mockCheckAuth.mockResolvedValue({ authenticated: false });

    render(<DashboardPage />);

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/login');
    });
  });

  it('shows user email in welcome message after data loads', async () => {
    render(<DashboardPage />);

    await waitFor(() => {
      expect(screen.getByText('test@example.com')).toBeInTheDocument();
    });

    expect(screen.getByText(/Welcome back,/)).toBeInTheDocument();
  });

  it('shows "Top 10 Trending" and "Top 10 Fading" section headings', async () => {
    render(<DashboardPage />);

    await waitFor(() => {
      expect(screen.getByText(/Top 10 Trending/)).toBeInTheDocument();
    });

    expect(screen.getByText(/Top 10 Fading/)).toBeInTheDocument();
  });

  it('shows empty state text when no stocks are found', async () => {
    render(<DashboardPage />);

    await waitFor(() => {
      expect(
        screen.getByText(/No trending stocks found/)
      ).toBeInTheDocument();
    });

    expect(screen.getByText(/No fading stocks found/)).toBeInTheDocument();
  });

  it('renders StockCard components when trending data is present', async () => {
    const trendingStocks = [
      {
        ticker: 'GME',
        mentionCount: 100,
        sentimentScore: 0.8,
        sentimentCategory: 'bullish',
        velocity: 200,
        timestamp: Date.now(),
      },
      {
        ticker: 'AMC',
        mentionCount: 80,
        sentimentScore: 0.5,
        sentimentCategory: 'bullish',
        velocity: 150,
        timestamp: Date.now(),
      },
    ];

    global.fetch = createMockFetch({
      trending: {
        success: true,
        data: { trending: trendingStocks, fading: [], timestamp: Date.now() },
      },
    }) as unknown as typeof fetch;

    render(<DashboardPage />);

    await waitFor(() => {
      expect(screen.getByTestId('stock-card-GME')).toBeInTheDocument();
    });

    expect(screen.getByTestId('stock-card-AMC')).toBeInTheDocument();
    expect(screen.getByText('StockCard: GME (trending)')).toBeInTheDocument();
    expect(screen.getByText('StockCard: AMC (trending)')).toBeInTheDocument();
  });

  it('renders StockCard components for fading stocks', async () => {
    const fadingStocks = [
      {
        ticker: 'BBBY',
        mentionCount: 50,
        sentimentScore: -0.3,
        sentimentCategory: 'bearish',
        velocity: -65,
        timestamp: Date.now(),
      },
    ];

    global.fetch = createMockFetch({
      trending: {
        success: true,
        data: { trending: [], fading: fadingStocks, timestamp: Date.now() },
      },
    }) as unknown as typeof fetch;

    render(<DashboardPage />);

    await waitFor(() => {
      expect(screen.getByTestId('stock-card-BBBY')).toBeInTheDocument();
    });

    expect(screen.getByText('StockCard: BBBY (fading)')).toBeInTheDocument();
  });

  it('shows error banner when fetch fails with error response', async () => {
    global.fetch = createMockFetch({
      trending: {
        success: false,
        error: 'Failed to fetch stock data',
      },
    }) as unknown as typeof fetch;

    render(<DashboardPage />);

    await waitFor(() => {
      expect(screen.getByText('Failed to fetch stock data')).toBeInTheDocument();
    });
  });

  it('shows error banner when fetch throws a network error', async () => {
    global.fetch = jest.fn((url: string) => {
      if (url.startsWith('/api/stocks/trending')) {
        return Promise.reject(new Error('Network error'));
      }
      if (url === '/api/stocks/surging') {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ success: true, data: { surging: [] } }),
        });
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
    }) as unknown as typeof fetch;

    render(<DashboardPage />);

    await waitFor(() => {
      expect(screen.getByText('Network error')).toBeInTheDocument();
    });
  });

  it('logout button calls logout and redirects to /login', async () => {
    render(<DashboardPage />);

    await waitFor(() => {
      expect(screen.getByText('test@example.com')).toBeInTheDocument();
    });

    await act(async () => {
      screen.getByRole('button', { name: /log out/i }).click();
    });

    expect(mockLogout).toHaveBeenCalledTimes(1);

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/login');
    });
  });

  it('renders SurgeAlert with surge data', async () => {
    global.fetch = createMockFetch({
      surging: {
        success: true,
        data: {
          surging: [
            {
              ticker: 'TSLA',
              mentionCount: 500,
              baselineMentions: 50,
              surgeMultiplier: 10,
              surgeScore: 90,
              sentimentScore: 0.6,
              sentimentCategory: 'bullish',
              detectedAt: Date.now(),
              sparklineData: [10, 20, 30],
            },
          ],
        },
      },
    }) as unknown as typeof fetch;

    render(<DashboardPage />);

    await waitFor(() => {
      expect(screen.getByTestId('surge-alert')).toBeInTheDocument();
    });

    expect(screen.getByText('SurgeAlert: 1 stocks')).toBeInTheDocument();
  });

  it('renders the "How Trends Are Calculated" section', async () => {
    render(<DashboardPage />);

    await waitFor(() => {
      expect(screen.getByText('How Trends Are Calculated')).toBeInTheDocument();
    });

    expect(screen.getByText('Data Collection')).toBeInTheDocument();
    expect(screen.getByText('Trending Algorithm')).toBeInTheDocument();
    expect(screen.getByText('Sentiment Analysis')).toBeInTheDocument();
  });

  it('renders RefreshTimer in the header', async () => {
    render(<DashboardPage />);

    await waitFor(() => {
      expect(screen.getByTestId('refresh-timer')).toBeInTheDocument();
    });
  });

  it('re-fetches trending, surging, and opportunities when Refresh is clicked', async () => {
    const mockFetch = createMockFetch();
    global.fetch = mockFetch as unknown as typeof fetch;

    render(<DashboardPage />);

    await waitFor(() => {
      expect(screen.getByTestId('refresh-timer')).toBeInTheDocument();
    });

    const countCalls = (predicate: (url: string) => boolean) =>
      mockFetch.mock.calls.filter(([url]) => predicate(url as string)).length;

    // Wait for initial data fetches to settle before snapshotting counts
    await waitFor(() => {
      expect(countCalls((u) => u.startsWith('/api/stocks/trending'))).toBeGreaterThan(0);
      expect(countCalls((u) => u === '/api/stocks/surging')).toBeGreaterThan(0);
      expect(countCalls((u) => u === '/api/stocks/opportunities')).toBeGreaterThan(0);
    });

    const initialTrending = countCalls((u) => u.startsWith('/api/stocks/trending'));
    const initialSurging = countCalls((u) => u === '/api/stocks/surging');
    const initialOpps = countCalls((u) => u === '/api/stocks/opportunities');

    await act(async () => {
      screen.getByRole('button', { name: /refresh/i }).click();
    });

    expect(countCalls((u) => u.startsWith('/api/stocks/trending'))).toBe(initialTrending + 1);
    expect(countCalls((u) => u === '/api/stocks/surging')).toBe(initialSurging + 1);
    expect(countCalls((u) => u === '/api/stocks/opportunities')).toBe(initialOpps + 1);
  });

  it('does not redirect when user is authenticated', async () => {
    render(<DashboardPage />);

    await waitFor(() => {
      expect(screen.getByText('test@example.com')).toBeInTheDocument();
    });

    expect(mockPush).not.toHaveBeenCalledWith('/login');
  });

  describe('Opportunities section', () => {
    it('hides opportunities section when no opportunities qualify', async () => {
      global.fetch = createMockFetch({
        opportunities: { success: true, data: { opportunities: [] } },
      }) as unknown as typeof fetch;

      render(<DashboardPage />);

      await waitFor(() => {
        expect(screen.getByText(/Top 10 Trending/)).toBeInTheDocument();
      });

      expect(screen.queryByText(/Opportunities/)).not.toBeInTheDocument();
    });

    it('renders opportunities section when hot/rising opportunities exist', async () => {
      const opportunities = [
        { ticker: 'GME', score: 80, signalLevel: 'hot', subScores: { velocity: 90, sentiment: 70, socialDominance: 85, volumeChange: 75, creatorInfluence: 60 } },
        { ticker: 'AMC', score: 55, signalLevel: 'rising', subScores: { velocity: 50, sentiment: 60, socialDominance: 40, volumeChange: 55, creatorInfluence: 30 } },
      ];

      global.fetch = createMockFetch({
        opportunities: { success: true, data: { opportunities } },
      }) as unknown as typeof fetch;

      render(<DashboardPage />);

      await waitFor(() => {
        expect(screen.getByText(/Opportunities/)).toBeInTheDocument();
      });

      expect(screen.getByTestId('opp-card-GME')).toBeInTheDocument();
      expect(screen.getByTestId('opp-card-AMC')).toBeInTheDocument();
    });

    it('shows opportunity cards sorted by rank', async () => {
      const opportunities = [
        { ticker: 'GME', score: 80, signalLevel: 'hot', subScores: { velocity: 90, sentiment: 70, socialDominance: 85, volumeChange: 75, creatorInfluence: 60 } },
        { ticker: 'AMC', score: 55, signalLevel: 'rising', subScores: { velocity: 50, sentiment: 60, socialDominance: 40, volumeChange: 55, creatorInfluence: 30 } },
      ];

      global.fetch = createMockFetch({
        opportunities: { success: true, data: { opportunities } },
      }) as unknown as typeof fetch;

      render(<DashboardPage />);

      await waitFor(() => {
        expect(screen.getByTestId('opp-card-GME')).toBeInTheDocument();
      });

      expect(screen.getByText(/OpportunityCard: GME #1/)).toBeInTheDocument();
      expect(screen.getByText(/OpportunityCard: AMC #2/)).toBeInTheDocument();
    });

    it('silently ignores opportunities fetch failure', async () => {
      global.fetch = jest.fn((url: string) => {
        if (url === '/api/stocks/opportunities') {
          return Promise.reject(new Error('Network error'));
        }
        if (url === '/api/stocks/trending') {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ success: true, data: { trending: [], fading: [], timestamp: Date.now() } }),
          });
        }
        if (url === '/api/stocks/surging') {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ success: true, data: { surging: [] } }),
          });
        }
        return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
      }) as unknown as typeof fetch;

      render(<DashboardPage />);

      await waitFor(() => {
        expect(screen.getByText(/Top 10 Trending/)).toBeInTheDocument();
      });

      // Dashboard still renders, no crash
      expect(screen.queryByText(/Opportunities/)).not.toBeInTheDocument();
    });
  });
});
