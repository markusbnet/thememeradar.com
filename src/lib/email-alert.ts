/**
 * Email alert content generation and deduplication utilities.
 *
 * These are pure functions — no DynamoDB calls here.
 * The DynamoDB layer lives in src/lib/db/alerts.ts.
 */

import type { OpportunityScore } from '@/lib/opportunity-score';

export function generateAlertSubject(ticker: string): string {
  return `🔥 Meme Radar: $${ticker} is showing strong buy signals`;
}

export function generateAlertBody(
  ticker: string,
  score: number,
  subScores: OpportunityScore['subScores'],
  appUrl: string = process.env.NEXT_PUBLIC_APP_URL ?? 'https://thememeradar.com'
): string {
  const filled = Math.round(score / 10);
  const scoreBar = '█'.repeat(filled) + '░'.repeat(10 - filled);
  return [
    `$${ticker} — Hot Opportunity Signal`,
    ``,
    `Opportunity Score: ${score}/100 [${scoreBar}]`,
    ``,
    `Sub-score breakdown:`,
    `  📈 Reddit velocity:     ${subScores.velocity.toFixed(0)}/100`,
    `  😊 Sentiment:           ${subScores.sentiment.toFixed(0)}/100`,
    `  🌐 Social dominance:    ${subScores.socialDominance.toFixed(0)}/100`,
    `  💰 Volume change:       ${subScores.volumeChange.toFixed(0)}/100`,
    `  ⭐ Creator influence:   ${subScores.creatorInfluence.toFixed(0)}/100`,
    ``,
    `View full details: ${appUrl}/stock/${ticker}`,
    ``,
    `— Meme Radar`,
  ].join('\n');
}

export function generateDailyDigestBody(
  opportunities: Array<{ ticker: string; score: number }>,
  appUrl: string = process.env.NEXT_PUBLIC_APP_URL ?? 'https://thememeradar.com'
): string {
  if (opportunities.length === 0) {
    return [
      `Daily Digest — No Hot Opportunities in the last 24 hours`,
      ``,
      `Check the dashboard: ${appUrl}/dashboard`,
    ].join('\n');
  }
  const lines = [
    `Daily Digest — Top Opportunities (last 24 hours)`,
    ``,
    ...opportunities
      .slice(0, 5)
      .map((o, i) => `${i + 1}. $${o.ticker} — Score: ${o.score}/100`),
    ``,
    `Full dashboard: ${appUrl}/dashboard`,
    ``,
    `— Meme Radar`,
  ];
  return lines.join('\n');
}

/**
 * Pure deduplication check — does not touch DynamoDB.
 * Pass in DB results externally so this function remains testable without I/O.
 *
 * Returns true when the ticker should receive a new alert (no recent alert
 * found within windowMs), false when a duplicate alert was sent recently.
 */
export function shouldSendAlert(
  ticker: string,
  windowMs: number,
  recentAlerts: Array<{ ticker: string; createdAt: number }>
): boolean {
  const cutoff = Date.now() - windowMs;
  return !recentAlerts.some((a) => a.ticker === ticker && a.createdAt > cutoff);
}
