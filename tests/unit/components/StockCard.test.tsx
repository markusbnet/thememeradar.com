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
    render(<StockCard {...defaultProps} velocity={245} />);
    expect(screen.getByText('245%')).toBeInTheDocument();
    expect(screen.getByText('↑')).toBeInTheDocument();
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
});
