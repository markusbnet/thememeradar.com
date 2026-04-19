import { render, screen } from '@testing-library/react';
import OpportunityCard from '@/components/OpportunityCard';
import type { OpportunityScore } from '@/lib/opportunity-score';

// Mock next/link
jest.mock('next/link', () => {
  return function MockLink({ children, href }: { children: React.ReactNode; href: string }) {
    return <a href={href}>{children}</a>;
  };
});

const makeOpp = (overrides: Partial<OpportunityScore> = {}): OpportunityScore => ({
  ticker: 'GME',
  score: 80,
  signalLevel: 'hot',
  subScores: {
    velocity: 90,
    sentiment: 70,
    socialDominance: 85,
    volumeChange: 75,
    creatorInfluence: 60,
  },
  ...overrides,
});

describe('OpportunityCard', () => {
  it('renders ticker symbol', () => {
    render(<OpportunityCard opportunity={makeOpp()} rank={1} />);
    expect(screen.getByText('$GME')).toBeInTheDocument();
  });

  it('renders rank number', () => {
    render(<OpportunityCard opportunity={makeOpp()} rank={3} />);
    expect(screen.getByText('#3')).toBeInTheDocument();
  });

  it('renders opportunity score', () => {
    render(<OpportunityCard opportunity={makeOpp({ score: 80 })} rank={1} />);
    expect(screen.getByText('80')).toBeInTheDocument();
  });

  it('renders hot signal with fire emoji', () => {
    render(<OpportunityCard opportunity={makeOpp({ signalLevel: 'hot', score: 80 })} rank={1} />);
    expect(screen.getByText(/Hot Opportunity|🔥/)).toBeInTheDocument();
  });

  it('renders rising signal with lightning emoji', () => {
    render(<OpportunityCard opportunity={makeOpp({ signalLevel: 'rising', score: 60 })} rank={1} />);
    expect(screen.getByText(/Rising Signal|⚡/)).toBeInTheDocument();
  });

  it('renders watch signal with eyes emoji', () => {
    render(<OpportunityCard opportunity={makeOpp({ signalLevel: 'watch', score: 35 })} rank={1} />);
    expect(screen.getByText(/Watch|👀/)).toBeInTheDocument();
  });

  it('renders all five sub-scores', () => {
    render(<OpportunityCard opportunity={makeOpp()} rank={1} />);
    expect(screen.getByText(/Velocity/i)).toBeInTheDocument();
    expect(screen.getByText(/Sentiment/i)).toBeInTheDocument();
    expect(screen.getByText(/Social/i)).toBeInTheDocument();
    expect(screen.getByText(/Volume/i)).toBeInTheDocument();
    expect(screen.getByText(/Creator/i)).toBeInTheDocument();
  });

  it('links to stock detail page', () => {
    render(<OpportunityCard opportunity={makeOpp({ ticker: 'TSLA' })} rank={1} />);
    const link = screen.getByRole('link');
    expect(link).toHaveAttribute('href', '/stock/TSLA');
  });

  it('applies red/hot styling for hot signal level', () => {
    const { container } = render(<OpportunityCard opportunity={makeOpp({ signalLevel: 'hot', score: 80 })} rank={1} />);
    expect(container.querySelector('.border-red-200, .border-orange-200, .bg-red-50, .bg-orange-50')).not.toBeNull();
  });

  it('applies yellow/rising styling for rising signal level', () => {
    const { container } = render(<OpportunityCard opportunity={makeOpp({ signalLevel: 'rising', score: 60 })} rank={1} />);
    expect(container.querySelector('.border-yellow-200, .border-amber-200, .bg-yellow-50, .bg-amber-50')).not.toBeNull();
  });

  it('renders score as 0-100 integer', () => {
    render(<OpportunityCard opportunity={makeOpp({ score: 73 })} rank={1} />);
    expect(screen.getByText('73')).toBeInTheDocument();
  });
});
