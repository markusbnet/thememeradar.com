/**
 * Surfaces pipeline liveness on the dashboard. Answers the "is the scanner
 * actually running, or am I just looking at stale data?" question without
 * making the user dig into /api/health.
 *
 * Data source: /api/health's `subsystems.scan.lastScanAt` — a timestamp of
 * the newest stock_mentions row within the last 24h, or null if none exist.
 */

'use client';

import { useEffect, useState } from 'react';

// Vercel Cron runs scans every 5 minutes. Anything older than 4x that is
// almost certainly the cron failing or the function timing out.
const STALE_THRESHOLD_MS = 20 * 60 * 1000;

type HealthResponse = {
  success: boolean;
  data?: {
    subsystems?: {
      scan?: {
        ok: boolean;
        lastScanAt: number | null;
      };
      scanRun?: {
        ok: boolean;
        status: 'running' | 'success' | 'failed' | 'unknown';
        lastRunFinishedAt: number | null;
        errorMessage: string | null;
      };
    };
  };
};

type ViewState =
  | { kind: 'loading' }
  | { kind: 'waiting' }
  | { kind: 'fresh'; ageMs: number }
  | { kind: 'stale'; ageMs: number }
  | { kind: 'failed'; errorMessage: string | null; ageMs: number | null }
  | { kind: 'unavailable' };

function formatAge(ageMs: number): string {
  if (ageMs < 60_000) return 'just now';
  const minutes = Math.floor(ageMs / 60_000);
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? '' : 's'} ago`;
  const hours = Math.floor(minutes / 60);
  return `${hours} hour${hours === 1 ? '' : 's'} ago`;
}

interface PipelineStatusProps {
  /**
   * Bumping this prop re-runs the health check. Dashboard passes the same
   * counter it uses for RefreshTimer so manual refresh also re-polls pipeline
   * freshness.
   */
  refreshKey?: number;
}

export default function PipelineStatus({ refreshKey = 0 }: PipelineStatusProps) {
  const [view, setView] = useState<ViewState>({ kind: 'loading' });

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const res = await fetch('/api/health');
        const body = (await res.json()) as HealthResponse;
        if (cancelled) return;

        // Heartbeat takes priority — it's an authoritative failure signal.
        // Fall back to the mention-timestamp check when heartbeat is unknown
        // (first run, pre-migration, or heartbeat query errored out).
        const scanRun = body.data?.subsystems?.scanRun;
        if (scanRun?.status === 'failed') {
          const ageMs = scanRun.lastRunFinishedAt
            ? Date.now() - scanRun.lastRunFinishedAt
            : null;
          setView({ kind: 'failed', errorMessage: scanRun.errorMessage, ageMs });
          return;
        }

        const lastScanAt = body.data?.subsystems?.scan?.lastScanAt ?? null;
        if (lastScanAt === null) {
          setView({ kind: 'waiting' });
          return;
        }

        const ageMs = Date.now() - lastScanAt;
        setView({ kind: ageMs > STALE_THRESHOLD_MS ? 'stale' : 'fresh', ageMs });
      } catch {
        if (!cancelled) setView({ kind: 'unavailable' });
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [refreshKey]);

  const base = 'text-xs font-medium px-2 py-1 rounded';

  switch (view.kind) {
    case 'loading':
      return <span className={`${base} bg-gray-100 text-gray-600`}>Checking pipeline…</span>;
    case 'waiting':
      return (
        <span className={`${base} bg-amber-50 text-amber-800`}>
          Waiting for first scan
        </span>
      );
    case 'fresh':
      return (
        <span className={`${base} bg-green-50 text-green-700`}>
          Last scan {formatAge(view.ageMs)}
        </span>
      );
    case 'stale':
      return (
        <span className={`${base} bg-amber-50 text-amber-800`}>
          Last scan {formatAge(view.ageMs)} — pipeline stale
        </span>
      );
    case 'failed': {
      const when = view.ageMs !== null ? formatAge(view.ageMs) : 'recently';
      const title = view.errorMessage ?? undefined;
      return (
        <span
          className={`${base} bg-red-50 text-red-700`}
          title={title}
        >
          Scan failed {when}
        </span>
      );
    }
    case 'unavailable':
      return (
        <span className={`${base} bg-gray-100 text-gray-600`}>
          Pipeline status unavailable
        </span>
      );
  }
}
