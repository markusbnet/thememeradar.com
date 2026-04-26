import { render, screen, waitFor, act } from '@testing-library/react';
import PipelineStatus from '@/components/PipelineStatus';

function mockHealth(lastScanAt: number | null, status: 'ok' | 'degraded' | 'down' = 'ok') {
  return jest.fn(() =>
    Promise.resolve({
      ok: status !== 'down',
      json: () =>
        Promise.resolve({
          success: status !== 'down',
          data: {
            status,
            subsystems: { scan: { ok: lastScanAt !== null, lastScanAt, recentMentions: 0 } },
          },
        }),
    })
  );
}

function mockHealthWithFailedRun(errorMessage: string, finishedAt = Date.now() - 60_000) {
  return jest.fn(() =>
    Promise.resolve({
      ok: true,
      json: () =>
        Promise.resolve({
          success: true,
          data: {
            status: 'degraded',
            subsystems: {
              scan: { ok: true, lastScanAt: finishedAt - 60_000, recentMentions: 1 },
              scanRun: {
                ok: false,
                status: 'failed',
                lastRunFinishedAt: finishedAt,
                errorMessage,
              },
            },
          },
        }),
    })
  );
}

describe('PipelineStatus', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    jest.restoreAllMocks();
    global.fetch = originalFetch;
  });

  it('shows a loading placeholder before the health check resolves', () => {
    global.fetch = jest.fn(() => new Promise(() => {})) as unknown as typeof fetch;
    render(<PipelineStatus />);
    expect(screen.getByText(/checking pipeline/i)).toBeInTheDocument();
  });

  it('renders "just now" when the latest scan is under a minute old', async () => {
    const recent = Date.now() - 30_000;
    global.fetch = mockHealth(recent) as unknown as typeof fetch;
    render(<PipelineStatus />);
    await waitFor(() => {
      expect(screen.getByText(/last scan.*just now/i)).toBeInTheDocument();
    });
  });

  it('renders minutes-ago relative time for a recent scan', async () => {
    const elevenMinAgo = Date.now() - 11 * 60_000;
    global.fetch = mockHealth(elevenMinAgo) as unknown as typeof fetch;
    render(<PipelineStatus />);
    await waitFor(() => {
      expect(screen.getByText(/last scan.*11 minutes? ago/i)).toBeInTheDocument();
    });
  });

  it('renders a "waiting for first scan" message when lastScanAt is null', async () => {
    global.fetch = mockHealth(null, 'degraded') as unknown as typeof fetch;
    render(<PipelineStatus />);
    await waitFor(() => {
      expect(screen.getByText(/waiting for first scan/i)).toBeInTheDocument();
    });
  });

  it('renders an unreachable message when the health endpoint errors', async () => {
    global.fetch = jest.fn(() => Promise.reject(new Error('network'))) as unknown as typeof fetch;
    render(<PipelineStatus />);
    await waitFor(() => {
      expect(screen.getByText(/pipeline status unavailable/i)).toBeInTheDocument();
    });
  });

  it('renders a "Scan failed" indicator when heartbeat reports a failure', async () => {
    global.fetch = mockHealthWithFailedRun('Reddit API 503') as unknown as typeof fetch;
    render(<PipelineStatus />);
    await waitFor(() => {
      expect(screen.getByText(/scan failed/i)).toBeInTheDocument();
    });
  });

  it('flags stale scans older than the stale threshold', async () => {
    // 21 minutes is > the 20-minute stale threshold. Using the boundary
    // value (20 min exactly) is racy because `Date.now()` evaluates again
    // inside the component, so nudge past the threshold for a deterministic
    // result.
    const twentyOneMinAgo = Date.now() - 21 * 60_000;
    global.fetch = mockHealth(twentyOneMinAgo) as unknown as typeof fetch;
    render(<PipelineStatus />);
    await waitFor(() => {
      expect(screen.getByText(/stale/i)).toBeInTheDocument();
    });
  });

  it('refetches health on demand when refreshKey prop changes', async () => {
    const fetchMock = jest.fn((_url: string) =>
      Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            success: true,
            data: {
              status: 'ok',
              subsystems: { scan: { ok: true, lastScanAt: Date.now() - 60_000, recentMentions: 1 } },
            },
          }),
      })
    );
    global.fetch = fetchMock as unknown as typeof fetch;

    const { rerender } = render(<PipelineStatus refreshKey={0} />);
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    await act(async () => {
      rerender(<PipelineStatus refreshKey={1} />);
    });

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(2);
    });
  });
});
