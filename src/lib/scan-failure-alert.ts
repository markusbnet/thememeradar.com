/**
 * Scan failure alerting. Writes an operational alert row into the email_alerts
 * table when /api/scan throws, so the existing Cowork email poller picks it up
 * and notifies the operator.
 *
 * Reuses email_alerts to avoid provisioning another table. The row is keyed by
 * a sentinel ticker (`__SCAN_FAILED__`) which never collides with real tickers
 * (no real symbol contains underscores). TTL is 24h, inherited from saveAlert.
 *
 * Storm control: we check for an existing unsent scan-failure alert within
 * the cooldown window before writing a new one. Vercel Cron fires every
 * 5 min; without cooldown a sustained Reddit outage would produce 288 alerts
 * per day.
 */

import { docClient, TABLES, PutCommand, QueryCommand } from '@/lib/db/client';
import { logger } from '@/lib/logger';

const SENTINEL_TICKER = '__SCAN_FAILED__';
const DEFAULT_COOLDOWN_MS = 30 * 60 * 1000; // 30 minutes

export interface ScanFailureAlertOptions {
  errorMessage: string;
  runId: string;
  now?: number;
  cooldownMs?: number;
}

export interface ScanFailureAlertResult {
  written: boolean;
  reason?: 'cooldown-active' | 'error';
}

export async function recordScanFailureAlert(
  options: ScanFailureAlertOptions
): Promise<ScanFailureAlertResult> {
  const now = options.now ?? Date.now();
  const cooldownMs = options.cooldownMs ?? DEFAULT_COOLDOWN_MS;
  const cutoff = now - cooldownMs;

  try {
    // Check for a recent unsent alert. If one exists, skip to avoid
    // bombarding the operator with duplicates.
    const recent = await docClient.send(
      new QueryCommand({
        TableName: TABLES.EMAIL_ALERTS,
        KeyConditionExpression: 'ticker = :t AND createdAt >= :cutoff',
        ExpressionAttributeValues: {
          ':t': SENTINEL_TICKER,
          ':cutoff': cutoff,
        },
        Limit: 1,
      })
    );
    if (recent.Items && recent.Items.length > 0) {
      return { written: false, reason: 'cooldown-active' };
    }

    const truncated = options.errorMessage.slice(0, 1000);
    await docClient.send(
      new PutCommand({
        TableName: TABLES.EMAIL_ALERTS,
        Item: {
          ticker: SENTINEL_TICKER,
          createdAt: now,
          // Operational alerts don't have a real opportunity score; use 0.
          opportunityScore: 0,
          subScores: {
            velocity: 0,
            sentiment: 0,
            socialDominance: 0,
            volumeChange: 0,
            creatorInfluence: 0,
          },
          emailSubject: '⚠️ Meme Radar: Scan pipeline failed',
          emailBody: buildFailureBody({
            errorMessage: truncated,
            runId: options.runId,
            now,
          }),
          sentAt: null,
          runId: options.runId,
          ttl: Math.floor(now / 1000) + 24 * 60 * 60,
        },
      })
    );
    return { written: true };
  } catch (err) {
    logger.error('Failed to record scan failure alert', err);
    return { written: false, reason: 'error' };
  }
}

function buildFailureBody(params: {
  errorMessage: string;
  runId: string;
  now: number;
}): string {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://thememeradar.com';
  return [
    'Meme Radar — Scan pipeline failed',
    '',
    `Run ID: ${params.runId}`,
    `Time:   ${new Date(params.now).toISOString()}`,
    '',
    'Error:',
    params.errorMessage,
    '',
    'Next auto-retry: on the next Vercel Cron tick (~5 min).',
    `Health check:    ${appUrl}/api/health`,
    '',
    '— Meme Radar',
  ].join('\n');
}

export const __test = { SENTINEL_TICKER };
