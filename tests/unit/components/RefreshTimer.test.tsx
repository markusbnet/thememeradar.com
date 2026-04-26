import { render, screen, act } from '@testing-library/react';
import RefreshTimer from '@/components/RefreshTimer';

// Mock next/navigation
const mockRefresh = jest.fn();
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    refresh: mockRefresh,
  }),
}));

describe('RefreshTimer', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    mockRefresh.mockClear();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('should render "just now" initially', () => {
    render(<RefreshTimer />);
    expect(screen.getByText('just now')).toBeInTheDocument();
  });

  it('should render "Last updated" label', () => {
    render(<RefreshTimer />);
    expect(screen.getByText('Last updated')).toBeInTheDocument();
  });

  it('should render "Next update in" label', () => {
    render(<RefreshTimer />);
    expect(screen.getByText('Next update in')).toBeInTheDocument();
  });

  it('should render Refresh button', () => {
    render(<RefreshTimer />);
    expect(screen.getByRole('button', { name: /refresh/i })).toBeInTheDocument();
  });

  it('should update time ago after seconds pass', () => {
    render(<RefreshTimer />);

    act(() => {
      jest.advanceTimersByTime(5000);
    });

    expect(screen.getByText('5 seconds ago')).toBeInTheDocument();
  });

  it('should show minutes after 60 seconds', () => {
    render(<RefreshTimer />);

    act(() => {
      jest.advanceTimersByTime(120000);
    });

    expect(screen.getByText('2 minutes ago')).toBeInTheDocument();
  });

  it('should call router.refresh on manual refresh click when no onRefresh prop is provided', () => {
    render(<RefreshTimer />);

    act(() => {
      screen.getByRole('button', { name: /refresh/i }).click();
    });

    expect(mockRefresh).toHaveBeenCalledTimes(1);
  });

  it('should invoke onRefresh callback on manual refresh click when provided', () => {
    const onRefresh = jest.fn();
    render(<RefreshTimer onRefresh={onRefresh} />);

    act(() => {
      screen.getByRole('button', { name: /refresh/i }).click();
    });

    expect(onRefresh).toHaveBeenCalledTimes(1);
    expect(mockRefresh).not.toHaveBeenCalled();
  });

  it('should invoke onRefresh callback on auto-refresh interval when provided', () => {
    const onRefresh = jest.fn();
    render(<RefreshTimer onRefresh={onRefresh} />);

    act(() => {
      jest.advanceTimersByTime(5 * 60 * 1000);
    });

    expect(onRefresh).toHaveBeenCalledTimes(1);
    expect(mockRefresh).not.toHaveBeenCalled();
  });

  it('should render singular "1 minute ago" at exactly 60 seconds elapsed', () => {
    render(<RefreshTimer />);

    act(() => {
      jest.advanceTimersByTime(60_000);
    });

    expect(screen.getByText('1 minute ago')).toBeInTheDocument();
    expect(screen.queryByText('1 minutes ago')).not.toBeInTheDocument();
  });

  it('should render singular "1 minute" remaining when 4 minutes elapsed', () => {
    render(<RefreshTimer />);

    // After 4 minutes, 1 minute remains until the 5-minute auto-refresh.
    act(() => {
      jest.advanceTimersByTime(4 * 60_000);
    });

    expect(screen.getByText('1 minute')).toBeInTheDocument();
    expect(screen.queryByText('1 minutes')).not.toBeInTheDocument();
  });
});
