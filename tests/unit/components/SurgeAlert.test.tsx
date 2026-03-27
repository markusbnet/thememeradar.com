import { render, screen } from '@testing-library/react';
import SurgeAlert from '@/components/SurgeAlert';
import type { SurgeStock } from '@/lib/db/surge';

// Mock next/link
jest.mock('next/link', () => {
  return function MockLink({ children, href }: { children: React.ReactNode; href: string }) {
    return <a href={href}>{children}</a>;
  };
});

const makeSurgeStock = (overrides: Partial<SurgeStock> = {}): SurgeStock => ({
  ticker: 'GME',
  mentionCount: 45,
  baselineMentions: 8,
  surgeMultiplier: 5.6,
  surgeScore: 0.72,
  sentimentScore: 0.65,
  sentimentCategory: 'bullish',
  detectedAt: Date.now(),
  sparklineData: [3, 5, 8, 12, 45],
  ...overrides,
});

describe('SurgeAlert', () => {
  it('should render nothing when surging array is empty', () => {
    const { container } = render(<SurgeAlert stocks={[]} />);
    expect(container.firstChild).toBeNull();
  });

  it('should render nothing when stocks prop is undefined', () => {
    const { container } = render(<SurgeAlert stocks={undefined as unknown as SurgeStock[]} />);
    expect(container.firstChild).toBeNull();
  });

  it('should render surge banner when stocks are provided', () => {
    render(<SurgeAlert stocks={[makeSurgeStock()]} />);
    expect(screen.getByText(/Surge Alert/i)).toBeInTheDocument();
  });

  it('should display ticker symbol for each surging stock', () => {
    render(<SurgeAlert stocks={[
      makeSurgeStock({ ticker: 'GME' }),
      makeSurgeStock({ ticker: 'AMC' }),
    ]} />);
    expect(screen.getByText('$GME')).toBeInTheDocument();
    expect(screen.getByText('$AMC')).toBeInTheDocument();
  });

  it('should display surge multiplier', () => {
    render(<SurgeAlert stocks={[makeSurgeStock({ surgeMultiplier: 5.6 })]} />);
    expect(screen.getByText('5.6x')).toBeInTheDocument();
  });

  it('should display mention count', () => {
    render(<SurgeAlert stocks={[makeSurgeStock({ mentionCount: 45 })]} />);
    expect(screen.getByText('45')).toBeInTheDocument();
  });

  it('should link each ticker to /stock/[ticker] detail page', () => {
    render(<SurgeAlert stocks={[makeSurgeStock({ ticker: 'TSLA' })]} />);
    const link = screen.getByRole('link');
    expect(link).toHaveAttribute('href', '/stock/TSLA');
  });

  it('should render at most 3 stocks even if more are passed', () => {
    const stocks = [
      makeSurgeStock({ ticker: 'GME' }),
      makeSurgeStock({ ticker: 'AMC' }),
      makeSurgeStock({ ticker: 'TSLA' }),
      makeSurgeStock({ ticker: 'BBBY' }),
      makeSurgeStock({ ticker: 'PLTR' }),
    ];
    render(<SurgeAlert stocks={stocks} />);
    expect(screen.getByText('$GME')).toBeInTheDocument();
    expect(screen.getByText('$AMC')).toBeInTheDocument();
    expect(screen.getByText('$TSLA')).toBeInTheDocument();
    expect(screen.queryByText('$BBBY')).not.toBeInTheDocument();
    expect(screen.queryByText('$PLTR')).not.toBeInTheDocument();
  });
});
