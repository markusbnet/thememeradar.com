import { render, screen } from '@testing-library/react';
import StockCard from '@/components/StockCard';

// Mock next/link
jest.mock('next/link', () => {
  return function MockLink({ children, href }: { children: React.ReactNode; href: string }) {
    return <a href={href}>{children}</a>;
  };
});

describe('StockCard', () => {
  const defaultProps = {
    rank: 1,
    ticker: 'GME',
    mentionCount: 1200,
    sentimentScore: 0.75,
    sentimentCategory: 'bullish',
    velocity: 245,
    timestamp: Date.now(),
    type: 'trending' as const,
  };

  it('should render ticker symbol', () => {
    render(<StockCard {...defaultProps} />);
    expect(screen.getByText('$GME')).toBeInTheDocument();
  });

  it('should render rank number', () => {
    render(<StockCard {...defaultProps} />);
    expect(screen.getByText('#1')).toBeInTheDocument();
  });

  it('should render mention count', () => {
    render(<StockCard {...defaultProps} />);
    expect(screen.getByText('1,200')).toBeInTheDocument();
  });

  it('should render sentiment label for bullish', () => {
    render(<StockCard {...defaultProps} sentimentCategory="bullish" />);
    expect(screen.getByText(/Bullish/)).toBeInTheDocument();
  });

  it('should render sentiment label for bearish', () => {
    render(<StockCard {...defaultProps} sentimentCategory="bearish" />);
    expect(screen.getByText(/Bearish/)).toBeInTheDocument();
  });

  it('should render sentiment label for neutral', () => {
    render(<StockCard {...defaultProps} sentimentCategory="neutral" />);
    expect(screen.getByText(/Neutral/)).toBeInTheDocument();
  });

  it('should display positive velocity with up arrow', () => {
    render(<StockCard {...defaultProps} velocity={245} mentionsPrev={10} />);
    expect(screen.getByText('245%')).toBeInTheDocument();
    expect(screen.getByText('↑')).toBeInTheDocument();
  });

  it('shows "NEW" in the velocity indicator when the ticker has no previous window', () => {
    // First-scan tickers have mentionsPrev=0 and storage pins velocity at 100%,
    // which visually reads as "+100% rising" — misleading. The indicator must
    // render "NEW" instead so users aren't told the stock just spiked when in
    // reality it just appeared.
    render(
      <StockCard {...defaultProps} velocity={100} mentionsPrev={0} mentionDelta={8} />
    );
    // The big velocity number should NOT say 100%.
    expect(screen.queryByText('100%')).not.toBeInTheDocument();
    // "NEW" should appear at least once (also rendered in the mention-delta area).
    expect(screen.getAllByText('NEW').length).toBeGreaterThan(0);
  });

  it('still shows the velocity percentage when mentionsPrev > 0', () => {
    render(<StockCard {...defaultProps} velocity={100} mentionsPrev={5} mentionDelta={5} />);
    expect(screen.getByText('100%')).toBeInTheDocument();
  });

  it('should display negative velocity with down arrow', () => {
    render(<StockCard {...defaultProps} velocity={-45} type="fading" />);
    expect(screen.getByText('45%')).toBeInTheDocument();
    expect(screen.getByText('↓')).toBeInTheDocument();
  });

  it('should link to stock detail page', () => {
    render(<StockCard {...defaultProps} ticker="AAPL" />);
    const link = screen.getByRole('link');
    expect(link).toHaveAttribute('href', '/stock/AAPL');
  });

  it('should show "Rising" for trending type', () => {
    render(<StockCard {...defaultProps} type="trending" />);
    expect(screen.getByText('Rising')).toBeInTheDocument();
  });

  it('should show "Fading" for fading type', () => {
    render(<StockCard {...defaultProps} type="fading" velocity={-10} />);
    expect(screen.getByText('Fading')).toBeInTheDocument();
  });

  it('should render sparkline when data is provided', () => {
    const { container } = render(
      <StockCard {...defaultProps} sparklineData={[10, 20, 15, 30, 25]} />
    );
    const svg = container.querySelector('svg');
    expect(svg).toBeInTheDocument();
  });

  it('should not render sparkline when data is absent', () => {
    const { container } = render(<StockCard {...defaultProps} />);
    const svg = container.querySelector('svg');
    expect(svg).not.toBeInTheDocument();
  });

  describe('enrichment display', () => {
    const enrichmentProps = {
      price: 24.50,
      changePct24h: 3.21,
      socialDominance: 12.5,
    };

    it('shows price when enrichment data provided', () => {
      render(<StockCard {...defaultProps} {...enrichmentProps} />);
      expect(screen.getByText('$24.50')).toBeInTheDocument();
    });

    it('shows positive 24h change in green', () => {
      render(<StockCard {...defaultProps} {...enrichmentProps} changePct24h={3.21} />);
      expect(screen.getByText('+3.21%')).toBeInTheDocument();
    });

    it('shows negative 24h change in red', () => {
      render(<StockCard {...defaultProps} {...enrichmentProps} changePct24h={-2.50} />);
      expect(screen.getByText('-2.50%')).toBeInTheDocument();
    });

    it('hides price block when no enrichment data provided', () => {
      render(<StockCard {...defaultProps} />);
      expect(screen.queryByText(/^\$\d+\.\d{2}$/)).not.toBeInTheDocument();
    });

    it('shows social dominance label', () => {
      render(<StockCard {...defaultProps} {...enrichmentProps} socialDominance={12.5} />);
      expect(screen.getByText(/Social/i)).toBeInTheDocument();
    });

    it('does not show social dominance when not provided', () => {
      render(<StockCard {...defaultProps} />);
      expect(screen.queryByText(/Social/i)).not.toBeInTheDocument();
    });
  });

  describe('mention count and delta display', () => {
    it('renders mentionCount formatted with commas', () => {
      render(<StockCard {...defaultProps} mentionCount={1243} />);
      expect(screen.getByText('1,243')).toBeInTheDocument();
    });

    it('renders positive mentionDelta with + prefix and "vs prev" label', () => {
      render(<StockCard {...defaultProps} mentionCount={1243} mentionsPrev={123} mentionDelta={1120} />);
      expect(screen.getByText('+1,120 vs prev')).toBeInTheDocument();
    });

    it('renders negative mentionDelta with - prefix and "vs prev" label', () => {
      render(<StockCard {...defaultProps} mentionCount={50} mentionsPrev={200} mentionDelta={-150} />);
      expect(screen.getByText('-150 vs prev')).toBeInTheDocument();
    });

    it('renders "NEW" when mentionsPrev is 0', () => {
      render(<StockCard {...defaultProps} mentionCount={8} mentionsPrev={0} mentionDelta={8} />);
      // "NEW" appears in both the velocity indicator and the mention-delta area.
      expect(screen.getAllByText('NEW').length).toBeGreaterThan(0);
    });

    it('does not render velocity as Infinity% or NaN%', () => {
      render(<StockCard {...defaultProps} velocity={0} mentionsPrev={0} mentionDelta={0} />);
      expect(screen.queryByText(/Infinity%/)).not.toBeInTheDocument();
      expect(screen.queryByText(/NaN%/)).not.toBeInTheDocument();
    });

    it('does not show delta when mentionDelta and mentionsPrev are not provided', () => {
      render(<StockCard {...defaultProps} />);
      expect(screen.queryByText(/vs prev/)).not.toBeInTheDocument();
      expect(screen.queryByText('NEW')).not.toBeInTheDocument();
    });

    it('has flex-col sm:flex-row layout for the mention count container', () => {
      const { container } = render(
        <StockCard {...defaultProps} mentionCount={500} mentionsPrev={100} mentionDelta={400} />
      );
      const flexContainer = container.querySelector('.flex-col.sm\\:flex-row');
      expect(flexContainer).toBeInTheDocument();
    });
  });

  describe('staleness display', () => {
    const priceProps = { price: 24.50, changePct24h: 3.21 };

    it('shows price normally when staleness is fresh', () => {
      render(<StockCard {...defaultProps} {...priceProps} staleness="fresh" />);
      expect(screen.getByText('$24.50')).toBeInTheDocument();
    });

    it('shows price normally when staleness is normal', () => {
      render(<StockCard {...defaultProps} {...priceProps} staleness="normal" />);
      expect(screen.getByText('$24.50')).toBeInTheDocument();
    });

    it('shows price in grey when staleness is grey', () => {
      render(<StockCard {...defaultProps} {...priceProps} staleness="grey" />);
      const priceEl = screen.getByText('$24.50');
      expect(priceEl).toBeInTheDocument();
      expect(priceEl.className).toContain('text-gray');
    });

    it('shows stale indicator when staleness is grey', () => {
      render(<StockCard {...defaultProps} {...priceProps} staleness="grey" />);
      expect(screen.getByTitle(/stale/i)).toBeInTheDocument();
    });

    it('hides price block when staleness is drop', () => {
      render(<StockCard {...defaultProps} {...priceProps} staleness="drop" />);
      expect(screen.queryByText('$24.50')).not.toBeInTheDocument();
    });

    it('renders normally when staleness prop is not provided', () => {
      render(<StockCard {...defaultProps} {...priceProps} />);
      expect(screen.getByText('$24.50')).toBeInTheDocument();
    });
  });
});
