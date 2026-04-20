/**
 * Alert pipeline — detects hot opportunity stocks after each scan and saves
 * pending email alerts to DynamoDB for Cowork to deliver via Gmail MCP.
 *
 * Fire-and-forget: called from scan/route.ts with .catch() so failures
 * never block the scan response.
 */

import { getTrendingStocks } from '@/lib/db/storage';
import { getLatestEnrichment } from '@/lib/db/enrichment';
import { computeOpportunityScore } from '@/lib/opportunity-score';
import { getRecentAlerts, saveAlert } from '@/lib/db/alerts';
import { generateAlertSubject, generateAlertBody, shouldSendAlert } from '@/lib/email-alert';
import { logger } from '@/lib/logger';

const ALERT_DEDUP_WINDOW_MS = 4 * 60 * 60 * 1000; // 4 hours

export async function checkAndCreateAlerts(tickers: string[]): Promise<void> {
  if (!tickers.length) return;

  const trending = await getTrendingStocks(50);
  const hotStocks = trending.filter((s) => tickers.includes(s.ticker));

  for (const stock of hotStocks) {
    const enrichment = await getLatestEnrichment(stock.ticker);
    const opportunity = computeOpportunityScore(stock, enrichment);

    if (opportunity.signalLevel !== 'hot') continue;

    const sinceMs = Date.now() - ALERT_DEDUP_WINDOW_MS;
    const recentAlerts = await getRecentAlerts(stock.ticker, sinceMs);
    if (!shouldSendAlert(stock.ticker, ALERT_DEDUP_WINDOW_MS, recentAlerts)) {
      logger.info(`Alert suppressed (duplicate within 4h): ${stock.ticker}`);
      continue;
    }

    const subject = generateAlertSubject(stock.ticker);
    const body = generateAlertBody(stock.ticker, opportunity.score, opportunity.subScores);

    await saveAlert({
      ticker: stock.ticker,
      createdAt: Date.now(),
      opportunityScore: opportunity.score,
      subScores: opportunity.subScores,
      emailSubject: subject,
      emailBody: body,
      sentAt: null,
    });

    logger.info(`Hot opportunity alert created: ${stock.ticker} (score: ${opportunity.score})`);
  }
}
