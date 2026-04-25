import { render, screen, fireEvent } from '@testing-library/react';
import StockTable from '@/components/StockTable';

// Mock next/link to avoid router dependency
jest.mock('next/link', () => {
  return function MockLink({ href, children, className }: { href: string; children: React.ReactNode; className?: string }) {
    return <a href={href} className={className}>{children}</a>;
  };
});

// Mock Sparkline to avoid SVG rendering complexity
jest.mock('@/components/Sparkline', () => {
  return function MockSparkline({ data }: { data: number[] }) {
    return <div data-testid="sparkline">{data.length} points</div>;
  };
});

import React from 'react';

const mockStocks = [
  {
    ticker: 'GME',
    mentionCount: 150,
    mentionDelta: 30,
    sentimentScore: 0.7,
    sentimentCategory: 'bullish',
    velocity: 25,
    timestamp: Date.now(),
    sparklineData: [10, 20, 15, 25, 30],
    rankDelta24h: 5,
    rankStatus: 'climbing' as const,
    price: 25.5,
    changePct24h: 3.2,
    staleness: 'fresh' as const,
  },
  {
    ticker: 'AMC',
    mentionCount: 80,
    mentionDelta: -10,
    sentimentScore: -0.2,
    sentimentCategory: 'neutral',
    velocity: -15,
    timestamp: Date.now(),
    sparklineData: [30, 25, 20, 15, 10],
    rankDelta24h: -2,
    rankStatus: 'falling' as const,
    price: 4.2,
    changePct24h: -1.5,
    staleness: 'normal' as const,
  },
];

describe('StockTable', () => {
  it('renders all required column headers', () => {
    render(<StockTable stocks={mockStocks} type="trending" />);
    expect(screen.getByRole('columnheader', { name: /Ticker/i })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: /Δ24h/i })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: /Mentions/i })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: /Velocity/i })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: /Sentiment/i })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: /Price/i })).toBeInTheDocument();
  });

  it('all column headers have scope="col"', () => {
    render(<StockTable stocks={mockStocks} type="trending" />);
    screen.getAllByRole('columnheader').forEach(th =>
      expect(th).toHaveAttribute('scope', 'col'),
    );
  });

  it('renders a row for each stock', () => {
    render(<StockTable stocks={mockStocks} type="trending" />);
    expect(screen.getByText('$GME')).toBeInTheDocument();
    expect(screen.getByText('$AMC')).toBeInTheDocument();
  });

  it('ticker cells are links to /stock/[ticker]', () => {
    render(<StockTable stocks={mockStocks} type="trending" />);
    const gmeLink = screen.getByText('$GME').closest('a');
    expect(gmeLink).toHaveAttribute('href', '/stock/GME');
    const amcLink = screen.getByText('$AMC').closest('a');
    expect(amcLink).toHaveAttribute('href', '/stock/AMC');
  });

  it('renders empty state when stocks array is empty', () => {
    render(<StockTable stocks={[]} type="trending" />);
    expect(screen.getByText(/No stocks found/i)).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  it('clicking Mentions header sorts stocks by mention count descending', () => {
    render(<StockTable stocks={mockStocks} type="trending" />);
    const header = screen.getByRole('columnheader', { name: /Mentions/i });
    fireEvent.click(header);
    const rows = screen.getAllByRole('row');
    // After sort desc, GME (150) should be row 1, AMC (80) row 2
    expect(rows[1].textContent).toContain('GME');
    expect(rows[2].textContent).toContain('AMC');
  });

  it('clicking the same header twice reverses sort direction', () => {
    render(<StockTable stocks={mockStocks} type="trending" />);
    const header = screen.getByRole('columnheader', { name: /Mentions/i });
    fireEvent.click(header); // desc: GME first
    fireEvent.click(header); // asc: AMC first (80 < 150)
    const rows = screen.getAllByRole('row');
    expect(rows[1].textContent).toContain('AMC');
  });

  it('pressing Enter on a sortable header triggers sort', () => {
    render(<StockTable stocks={mockStocks} type="trending" />);
    const header = screen.getByRole('columnheader', { name: /Mentions/i });
    fireEvent.keyDown(header, { key: 'Enter' });
    // Descending arrow should now appear in the header
    expect(header.textContent).toMatch(/[↓]/);
  });

  it('sortable headers have tabIndex=0 for keyboard navigation', () => {
    render(<StockTable stocks={mockStocks} type="trending" />);
    const mentionsHeader = screen.getByRole('columnheader', { name: /Mentions/i });
    expect(mentionsHeader).toHaveAttribute('tabIndex', '0');
  });

  it('renders ↑N for climbing rank delta', () => {
    render(<StockTable stocks={mockStocks} type="trending" />);
    expect(screen.getByText('↑5')).toBeInTheDocument();
  });

  it('renders ↓N for falling rank delta', () => {
    render(<StockTable stocks={mockStocks} type="trending" />);
    expect(screen.getByText('↓2')).toBeInTheDocument();
  });

  it('renders NEW badge for new stocks', () => {
    const newStock = { ...mockStocks[0], ticker: 'BIRD', rankStatus: 'new' as const, rankDelta24h: null };
    render(<StockTable stocks={[newStock]} type="trending" />);
    expect(screen.getByText('NEW')).toBeInTheDocument();
  });

  it('renders dash for price when staleness is drop', () => {
    const staleStock = { ...mockStocks[0], staleness: 'drop' as const };
    render(<StockTable stocks={[staleStock]} type="trending" />);
    // Price cell should show dash (using — character)
    const rows = screen.getAllByRole('row');
    expect(rows[1].textContent).toContain('—');
  });

  it('renders sparklines when sparklineData is present', () => {
    render(<StockTable stocks={mockStocks} type="trending" />);
    expect(screen.getAllByTestId('sparkline')).toHaveLength(2);
  });
});
