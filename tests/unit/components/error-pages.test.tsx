import { render, screen, fireEvent } from '@testing-library/react';
import GlobalError from '@/app/error';
import NotFound from '@/app/not-found';
import DashboardError from '@/app/dashboard/error';
import StockDetailError from '@/app/stock/[ticker]/error';

// Mock next/link
jest.mock('next/link', () => {
  return function MockLink({ children, href }: { children: React.ReactNode; href: string }) {
    return <a href={href}>{children}</a>;
  };
});

describe('GlobalError', () => {
  const mockReset = jest.fn();
  const mockError = new Error('Test error');

  beforeEach(() => {
    mockReset.mockClear();
  });

  it('renders error heading', () => {
    render(<GlobalError error={mockError} reset={mockReset} />);
    expect(screen.getByText('Something went wrong')).toBeDefined();
  });

  it('renders error description', () => {
    render(<GlobalError error={mockError} reset={mockReset} />);
    expect(screen.getByText(/unexpected error occurred/i)).toBeDefined();
  });

  it('renders Try Again button', () => {
    render(<GlobalError error={mockError} reset={mockReset} />);
    expect(screen.getByRole('button', { name: /try again/i })).toBeDefined();
  });

  it('calls reset when Try Again is clicked', () => {
    render(<GlobalError error={mockError} reset={mockReset} />);
    fireEvent.click(screen.getByRole('button', { name: /try again/i }));
    expect(mockReset).toHaveBeenCalledTimes(1);
  });
});

describe('NotFound', () => {
  it('renders 404 heading', () => {
    render(<NotFound />);
    expect(screen.getByText('404')).toBeDefined();
  });

  it('renders Page Not Found text', () => {
    render(<NotFound />);
    expect(screen.getByText('Page Not Found')).toBeDefined();
  });

  it('renders Go Home link', () => {
    render(<NotFound />);
    const homeLink = screen.getByRole('link', { name: /go home/i });
    expect(homeLink).toBeDefined();
    expect(homeLink.getAttribute('href')).toBe('/');
  });

  it('renders Dashboard link', () => {
    render(<NotFound />);
    const dashLink = screen.getByRole('link', { name: /dashboard/i });
    expect(dashLink).toBeDefined();
    expect(dashLink.getAttribute('href')).toBe('/dashboard');
  });
});

describe('DashboardError', () => {
  const mockReset = jest.fn();
  const mockError = new Error('Dashboard failed');

  beforeEach(() => {
    mockReset.mockClear();
  });

  it('renders Dashboard Error heading', () => {
    render(<DashboardError error={mockError} reset={mockReset} />);
    expect(screen.getByText('Dashboard Error')).toBeDefined();
  });

  it('renders error description', () => {
    render(<DashboardError error={mockError} reset={mockReset} />);
    expect(screen.getByText(/failed to load the dashboard/i)).toBeDefined();
  });

  it('calls reset when Try Again is clicked', () => {
    render(<DashboardError error={mockError} reset={mockReset} />);
    fireEvent.click(screen.getByRole('button', { name: /try again/i }));
    expect(mockReset).toHaveBeenCalledTimes(1);
  });

  it('renders Go Home link', () => {
    render(<DashboardError error={mockError} reset={mockReset} />);
    const homeLink = screen.getByRole('link', { name: /go home/i });
    expect(homeLink.getAttribute('href')).toBe('/');
  });
});

describe('StockDetailError', () => {
  const mockReset = jest.fn();
  const mockError = new Error('Stock data failed');

  beforeEach(() => {
    mockReset.mockClear();
  });

  it('renders Stock Data Error heading', () => {
    render(<StockDetailError error={mockError} reset={mockReset} />);
    expect(screen.getByText('Stock Data Error')).toBeDefined();
  });

  it('renders error description', () => {
    render(<StockDetailError error={mockError} reset={mockReset} />);
    expect(screen.getByText(/failed to load stock details/i)).toBeDefined();
  });

  it('calls reset when Try Again is clicked', () => {
    render(<StockDetailError error={mockError} reset={mockReset} />);
    fireEvent.click(screen.getByRole('button', { name: /try again/i }));
    expect(mockReset).toHaveBeenCalledTimes(1);
  });

  it('renders Back to Dashboard link', () => {
    render(<StockDetailError error={mockError} reset={mockReset} />);
    const dashLink = screen.getByRole('link', { name: /back to dashboard/i });
    expect(dashLink.getAttribute('href')).toBe('/dashboard');
  });
});
