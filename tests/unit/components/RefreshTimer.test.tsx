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

  it('should call router.refresh on manual refresh click', () => {
    render(<RefreshTimer />);

    act(() => {
      screen.getByRole('button', { name: /refresh/i }).click();
    });

    expect(mockRefresh).toHaveBeenCalledTimes(1);
  });
});
