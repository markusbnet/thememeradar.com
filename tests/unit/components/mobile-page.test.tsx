jest.mock('@/lib/db/storage', () => ({
  getTrendingStocks: jest.fn(),
}));
jest.mock('@/lib/db/apewisdom', () => ({
  getLatestApewisdomSnapshot: jest.fn().mockResolvedValue(null),
}));
jest.mock('@/lib/coverage/apewisdom', () => jest.requireActual('@/lib/coverage/apewisdom'));
jest.mock('@/lib/db/prices', () => ({
  getLatestPriceMap: jest.fn().mockResolvedValue(new Map()),
}));

import { render, screen } from '@testing-library/react';
import MobilePage from '@/app/m/page';
import { getTrendingStocks } from '@/lib/db/storage';
import type { TrendingStock } from '@/lib/db/storage';

const mockGetTrending = getTrendingStocks as jest.MockedFunction<typeof getTrendingStocks>;

const makeTrendingStock = (ticker: string, velocity: number, rank: number): TrendingStock => ({
  ticker,
  mentionCount: 100 + rank * 10,
  mentionsPrev: 50,
  mentionDelta: 50,
  sentimentScore: 0.5,
  sentimentCategory: 'bullish',
  velocity,
  timestamp: 1700000000000,
  rankDelta24h: null,
  rankStatus: 'new',
});

const tenStocks: TrendingStock[] = Array.from({ length: 10 }, (_, i) =>
  makeTrendingStock(`TICK${i + 1}`, 100 - i * 5, i + 1)
);

beforeEach(() => {
  mockGetTrending.mockResolvedValue(tenStocks);
});

afterEach(() => jest.clearAllMocks());

describe('/m mobile page', () => {
  it('renders without crashing', async () => {
    const element = await MobilePage();
    const { container } = render(element);
    expect(container).toBeTruthy();
  });

  it('renders all 10 tickers', async () => {
    const element = await MobilePage();
    render(element);
    for (const stock of tenStocks) {
      expect(screen.getByText(`$${stock.ticker}`, { exact: true })).toBeInTheDocument();
    }
  });

  it('renders page heading', async () => {
    const element = await MobilePage();
    render(element);
    expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument();
  });

  it('shows velocity for first stock', async () => {
    const element = await MobilePage();
    render(element);
    // velocity=100 → should show "+100%"
    expect(screen.getAllByText(/\+100%/)[0]).toBeInTheDocument();
  });

  it('shows price when available', async () => {
    const { getLatestPriceMap } = require('@/lib/db/prices');
    (getLatestPriceMap as jest.Mock).mockResolvedValue(
      new Map([['TICK1', { price: 28.45, changePct24h: 5.2, staleness: 'fresh', timestamp: 0, ticker: 'TICK1', volume: 0, dayHigh: 0, dayLow: 0, dayOpen: 0, previousClose: 0, fetchedAt: 0, ttl: 0 }]])
    );
    const element = await MobilePage();
    render(element);
    expect(screen.getByText(/28\.45/)).toBeInTheDocument();
  });

  it('has a link back to the dashboard', async () => {
    const element = await MobilePage();
    render(element);
    const link = screen.getByRole('link', { name: /dashboard/i });
    expect(link).toHaveAttribute('href', '/dashboard');
  });

  it('renders without any script tags (no client JS)', async () => {
    const element = await MobilePage();
    const { container } = render(element);
    const scripts = container.querySelectorAll('script');
    expect(scripts).toHaveLength(0);
  });
});
