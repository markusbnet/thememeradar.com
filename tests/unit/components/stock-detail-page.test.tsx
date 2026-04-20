import { render, screen, waitFor, act } from '@testing-library/react';

// Mock next/navigation
const mockPush = jest.fn();
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
}));

// Mock next/link
jest.mock('next/link', () => {
  return function MockLink({ children, href, className }: { children: React.ReactNode; href: string; className?: string }) {
    return <a href={href} className={className}>{children}</a>;
  };
});

// Mock auth client
const mockCheckAuth = jest.fn();
jest.mock('@/lib/auth/client', () => ({
  checkAuth: (...args: unknown[]) => mockCheckAuth(...args),
}));

// Mock child components as simple stubs
jest.mock('@/components/StockChart', () => {
  return function MockStockChart({ title }: { title: string }) {
    return <div data-testid="stock-chart">{title}</div>;
  };
});

jest.mock('@/components/CollapsibleSection', () => {
  return function MockCollapsibleSection({ title, children }: { title: string; children: React.ReactNode }) {
    return (
      <div data-testid="collapsible-section">
        <h3>{title}</h3>
        <div>{children}</div>
      </div>
    );
  };
});

import StockDetailPage from '@/app/stock/[ticker]/page';

const mockStockDetails = {
  success: true,
  data: {
    details: {
      ticker: 'TSLA',
      timestamp: Date.now(),
      mentionCount: 500,
      uniquePosts: 120,
      uniqueComments: 380,
      avgSentimentScore: 0.45,
      sentimentCategory: 'bullish',
      bullishCount: 300,
      bearishCount: 80,
      neutralCount: 120,
      totalUpvotes: 15000,
      subredditBreakdown: { wallstreetbets: 350, stocks: 100, investing: 50 },
      topKeywords: ['moon', 'diamond hands', 'YOLO'],
    },
    evidence: [],
    history: {
      mentions: [{ label: 'Day 1', value: 100 }],
      sentiment: [{ label: 'Day 1', value: 0.5 }],
    },
    timeBreakdown: null,
  },
};

describe('StockDetailPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCheckAuth.mockResolvedValue({ authenticated: true, user: { email: 'test@example.com' } });
    global.fetch = jest.fn().mockResolvedValue({
      json: () => Promise.resolve(mockStockDetails),
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('shows loading spinner initially', async () => {
    // Make checkAuth hang so the component stays in loading state
    mockCheckAuth.mockReturnValue(new Promise(() => {}));

    await act(async () => {
      render(<StockDetailPage params={Promise.resolve({ ticker: 'TSLA' })} />);
    });

    expect(screen.getByText('Loading stock details...')).toBeInTheDocument();
  });

  it('redirects to login when not authenticated', async () => {
    mockCheckAuth.mockResolvedValue({ authenticated: false });

    await act(async () => {
      render(<StockDetailPage params={Promise.resolve({ ticker: 'TSLA' })} />);
    });

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/login');
    });
  });

  it('shows error state with Error heading and Back to Dashboard link when stock not found', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      json: () => Promise.resolve({ success: false, error: 'Stock not found' }),
    });

    await act(async () => {
      render(<StockDetailPage params={Promise.resolve({ ticker: 'ZZZZ' })} />);
    });

    await waitFor(() => {
      expect(screen.getByText('Error')).toBeInTheDocument();
    });

    expect(screen.getByText('Stock not found')).toBeInTheDocument();
    const backLink = screen.getByText(/Back to Dashboard/);
    expect(backLink.closest('a')).toHaveAttribute('href', '/dashboard');
  });

  it('shows stock header with $TICKER when data loads successfully', async () => {
    await act(async () => {
      render(<StockDetailPage params={Promise.resolve({ ticker: 'TSLA' })} />);
    });

    await waitFor(() => {
      expect(screen.getByText('$TSLA')).toBeInTheDocument();
    });
  });

  it('shows all 4 statistics cards', async () => {
    await act(async () => {
      render(<StockDetailPage params={Promise.resolve({ ticker: 'TSLA' })} />);
    });

    await waitFor(() => {
      expect(screen.getByText('Total Mentions')).toBeInTheDocument();
    });

    expect(screen.getByText('Unique Posts')).toBeInTheDocument();
    expect(screen.getByText('Comments')).toBeInTheDocument();
    expect(screen.getByText('Total Upvotes')).toBeInTheDocument();

    // Check values
    expect(screen.getByText('500')).toBeInTheDocument();
    expect(screen.getByText('120')).toBeInTheDocument();
    expect(screen.getByText('380')).toBeInTheDocument();
    expect(screen.getByText('15,000')).toBeInTheDocument();
  });

  it('shows sentiment badge with Bullish label for bullish category', async () => {
    await act(async () => {
      render(<StockDetailPage params={Promise.resolve({ ticker: 'TSLA' })} />);
    });

    await waitFor(() => {
      expect(screen.getByText('Bullish')).toBeInTheDocument();
    });
  });

  it('shows sentiment badge with Strong Bullish label for strong_bullish category', async () => {
    const strongBullishData = {
      ...mockStockDetails,
      data: {
        ...mockStockDetails.data,
        details: {
          ...mockStockDetails.data.details,
          sentimentCategory: 'strong_bullish',
          avgSentimentScore: 0.85,
        },
      },
    };
    (global.fetch as jest.Mock).mockResolvedValue({
      json: () => Promise.resolve(strongBullishData),
    });

    await act(async () => {
      render(<StockDetailPage params={Promise.resolve({ ticker: 'TSLA' })} />);
    });

    await waitFor(() => {
      expect(screen.getByText('Strong Bullish')).toBeInTheDocument();
    });
  });

  it('shows sentiment badge with Bearish label for bearish category', async () => {
    const bearishData = {
      ...mockStockDetails,
      data: {
        ...mockStockDetails.data,
        details: {
          ...mockStockDetails.data.details,
          sentimentCategory: 'bearish',
          avgSentimentScore: -0.4,
        },
      },
    };
    (global.fetch as jest.Mock).mockResolvedValue({
      json: () => Promise.resolve(bearishData),
    });

    await act(async () => {
      render(<StockDetailPage params={Promise.resolve({ ticker: 'TSLA' })} />);
    });

    await waitFor(() => {
      expect(screen.getByText('Bearish')).toBeInTheDocument();
    });
  });

  it('shows sentiment badge with Strong Bearish label for strong_bearish category', async () => {
    const strongBearishData = {
      ...mockStockDetails,
      data: {
        ...mockStockDetails.data,
        details: {
          ...mockStockDetails.data.details,
          sentimentCategory: 'strong_bearish',
          avgSentimentScore: -0.9,
        },
      },
    };
    (global.fetch as jest.Mock).mockResolvedValue({
      json: () => Promise.resolve(strongBearishData),
    });

    await act(async () => {
      render(<StockDetailPage params={Promise.resolve({ ticker: 'TSLA' })} />);
    });

    await waitFor(() => {
      expect(screen.getByText('Strong Bearish')).toBeInTheDocument();
    });
  });

  it('shows sentiment badge with Neutral label for neutral/unknown category', async () => {
    const neutralData = {
      ...mockStockDetails,
      data: {
        ...mockStockDetails.data,
        details: {
          ...mockStockDetails.data.details,
          sentimentCategory: 'neutral',
          avgSentimentScore: 0.0,
        },
      },
    };
    (global.fetch as jest.Mock).mockResolvedValue({
      json: () => Promise.resolve(neutralData),
    });

    await act(async () => {
      render(<StockDetailPage params={Promise.resolve({ ticker: 'TSLA' })} />);
    });

    await waitFor(() => {
      expect(screen.getByText('Neutral')).toBeInTheDocument();
    });
  });

  it('renders StockChart components for mentions and sentiment history', async () => {
    await act(async () => {
      render(<StockDetailPage params={Promise.resolve({ ticker: 'TSLA' })} />);
    });

    await waitFor(() => {
      expect(screen.getByText('Mention Count (7 Days)')).toBeInTheDocument();
    });

    expect(screen.getByText('Sentiment Score (7 Days)')).toBeInTheDocument();
  });

  it('renders CollapsibleSection for Sentiment Breakdown and Subreddit Breakdown', async () => {
    await act(async () => {
      render(<StockDetailPage params={Promise.resolve({ ticker: 'TSLA' })} />);
    });

    await waitFor(() => {
      expect(screen.getByText('Sentiment Breakdown')).toBeInTheDocument();
    });

    expect(screen.getByText('Subreddit Breakdown')).toBeInTheDocument();
  });

  it('displays sentiment score value', async () => {
    await act(async () => {
      render(<StockDetailPage params={Promise.resolve({ ticker: 'TSLA' })} />);
    });

    await waitFor(() => {
      expect(screen.getByText('0.45')).toBeInTheDocument();
    });
  });

  it('uppercases the ticker from params', async () => {
    await act(async () => {
      render(<StockDetailPage params={Promise.resolve({ ticker: 'tsla' })} />);
    });

    await waitFor(() => {
      expect(screen.getByText('$TSLA')).toBeInTheDocument();
    });

    expect(global.fetch).toHaveBeenCalledWith('/api/stocks/TSLA');
  });

  it('shows error state when fetch throws an exception', async () => {
    (global.fetch as jest.Mock).mockRejectedValue(new Error('Network error'));

    await act(async () => {
      render(<StockDetailPage params={Promise.resolve({ ticker: 'TSLA' })} />);
    });

    await waitFor(() => {
      expect(screen.getByText('Error')).toBeInTheDocument();
    });

    expect(screen.getByText('Network error')).toBeInTheDocument();
  });

  it('shows Notable Creators section when enrichment has top_creators', async () => {
    const withCreators = {
      ...mockStockDetails,
      data: {
        ...mockStockDetails.data,
        enrichment: {
          price: 25.0,
          volume_24h: 1_000_000,
          percent_change_24h: 5,
          social_dominance: 3,
          galaxy_score: 60,
          sentiment: 4,
          engagements: 50_000,
          mentions_cross_platform: 200,
          engagements_by_network: {},
          top_creators: [
            { screen_name: 'influencer1', network: 'twitter', influencer_rank: 10, followers: 500_000, posts: 5, engagements: 10_000 },
          ],
        },
      },
    };
    (global.fetch as jest.Mock).mockResolvedValue({
      json: () => Promise.resolve(withCreators),
    });

    await act(async () => {
      render(<StockDetailPage params={Promise.resolve({ ticker: 'TSLA' })} />);
    });

    await waitFor(() => {
      expect(screen.getByText('Notable Creators')).toBeInTheDocument();
    });

    expect(screen.getByText('@influencer1')).toBeInTheDocument();
  });

  it('shows Notable badge for creator with rank <= 100', async () => {
    const withNotableCreator = {
      ...mockStockDetails,
      data: {
        ...mockStockDetails.data,
        enrichment: {
          price: 25.0,
          volume_24h: 1_000_000,
          percent_change_24h: 5,
          social_dominance: 3,
          galaxy_score: 60,
          sentiment: 4,
          engagements: 50_000,
          mentions_cross_platform: 200,
          engagements_by_network: {},
          top_creators: [
            { screen_name: 'topinfluencer', network: 'reddit', influencer_rank: 50, followers: 80_000, posts: 3, engagements: 5_000 },
          ],
        },
      },
    };
    (global.fetch as jest.Mock).mockResolvedValue({
      json: () => Promise.resolve(withNotableCreator),
    });

    await act(async () => {
      render(<StockDetailPage params={Promise.resolve({ ticker: 'TSLA' })} />);
    });

    await waitFor(() => {
      expect(screen.getByText('@topinfluencer')).toBeInTheDocument();
    });

    expect(screen.getByText('Notable')).toBeInTheDocument();
  });

  it('does not show Notable Creators section when enrichment has no top_creators', async () => {
    const withoutCreators = {
      ...mockStockDetails,
      data: {
        ...mockStockDetails.data,
        enrichment: {
          price: 25.0,
          volume_24h: 1_000_000,
          percent_change_24h: 5,
          social_dominance: 3,
          galaxy_score: 60,
          sentiment: 4,
          engagements: 50_000,
          mentions_cross_platform: 200,
          engagements_by_network: {},
          top_creators: [],
        },
      },
    };
    (global.fetch as jest.Mock).mockResolvedValue({
      json: () => Promise.resolve(withoutCreators),
    });

    await act(async () => {
      render(<StockDetailPage params={Promise.resolve({ ticker: 'TSLA' })} />);
    });

    await waitFor(() => {
      expect(screen.getByText('$TSLA')).toBeInTheDocument();
    });

    expect(screen.queryByText('Notable Creators')).not.toBeInTheDocument();
  });
});
