/**
 * Unit tests for src/lib/email-alert.ts
 *
 * Tests cover:
 *   - generateAlertSubject
 *   - generateAlertBody
 *   - generateDailyDigestBody
 *   - shouldSendAlert
 */

import {
  generateAlertSubject,
  generateAlertBody,
  generateDailyDigestBody,
  shouldSendAlert,
} from '@/lib/email-alert';
import type { OpportunityScore } from '@/lib/opportunity-score';

const baseSubScores: OpportunityScore['subScores'] = {
  velocity: 80,
  sentiment: 70,
  socialDominance: 60,
  volumeChange: 90,
  creatorInfluence: 50,
};

describe('generateAlertSubject', () => {
  it('returns subject string containing the ticker', () => {
    const subject = generateAlertSubject('GME');
    expect(subject).toContain('GME');
  });

  it('returns correct formatted subject', () => {
    const subject = generateAlertSubject('TSLA');
    expect(subject).toBe('🔥 Meme Radar: $TSLA is showing strong buy signals');
  });

  it('works with different tickers', () => {
    expect(generateAlertSubject('AMC')).toContain('AMC');
    expect(generateAlertSubject('PLTR')).toContain('PLTR');
  });
});

describe('generateAlertBody', () => {
  it('includes the ticker in the body', () => {
    const body = generateAlertBody('GME', 82, baseSubScores);
    expect(body).toContain('GME');
  });

  it('includes the score in the body', () => {
    const body = generateAlertBody('GME', 82, baseSubScores);
    expect(body).toContain('82');
  });

  it('includes the velocity sub-score label', () => {
    const body = generateAlertBody('GME', 82, baseSubScores);
    expect(body).toContain('velocity');
  });

  it('includes the sentiment sub-score label', () => {
    const body = generateAlertBody('GME', 82, baseSubScores);
    expect(body).toContain('Sentiment');
  });

  it('includes the social dominance sub-score label', () => {
    const body = generateAlertBody('GME', 82, baseSubScores);
    expect(body).toContain('Social dominance');
  });

  it('includes the volume change sub-score label', () => {
    const body = generateAlertBody('GME', 82, baseSubScores);
    expect(body).toContain('Volume change');
  });

  it('includes the creator influence sub-score label', () => {
    const body = generateAlertBody('GME', 82, baseSubScores);
    expect(body).toContain('Creator influence');
  });

  it('formats sub-score values in the body', () => {
    const body = generateAlertBody('GME', 82, baseSubScores);
    // velocity is 80
    expect(body).toContain('80');
    // sentiment is 70
    expect(body).toContain('70');
  });

  it('includes a link to the stock detail page', () => {
    const body = generateAlertBody('GME', 82, baseSubScores, 'https://thememeradar.com');
    expect(body).toContain('/stock/GME');
  });

  it('includes a score bar with blocks', () => {
    const body = generateAlertBody('GME', 100, baseSubScores);
    expect(body).toContain('█');
  });

  it('uses custom appUrl when provided', () => {
    const body = generateAlertBody('GME', 82, baseSubScores, 'http://localhost:3000');
    expect(body).toContain('http://localhost:3000');
  });
});

describe('generateDailyDigestBody', () => {
  it('includes "Daily Digest" heading', () => {
    const body = generateDailyDigestBody([{ ticker: 'GME', score: 85 }]);
    expect(body).toContain('Daily Digest');
  });

  it('includes each opportunity ticker', () => {
    const body = generateDailyDigestBody([
      { ticker: 'GME', score: 85 },
      { ticker: 'AMC', score: 76 },
    ]);
    expect(body).toContain('GME');
    expect(body).toContain('AMC');
  });

  it('handles empty array gracefully', () => {
    const body = generateDailyDigestBody([]);
    expect(body).toContain('Daily Digest');
    expect(body).not.toContain('undefined');
    expect(body.length).toBeGreaterThan(0);
  });

  it('empty array includes a message indicating no opportunities', () => {
    const body = generateDailyDigestBody([]);
    expect(body).toContain('No Hot Opportunities');
  });

  it('includes scores in the digest', () => {
    const body = generateDailyDigestBody([{ ticker: 'TSLA', score: 88 }]);
    expect(body).toContain('88');
  });

  it('uses custom appUrl in digest', () => {
    const body = generateDailyDigestBody([], 'http://localhost:3000');
    expect(body).toContain('http://localhost:3000');
  });

  it('caps at 5 entries', () => {
    const opportunities = Array.from({ length: 10 }, (_, i) => ({
      ticker: `T${i}`,
      score: 80 - i,
    }));
    const body = generateDailyDigestBody(opportunities);
    // First 5 should be included
    expect(body).toContain('T0');
    expect(body).toContain('T4');
    // Items beyond 5 should not appear
    expect(body).not.toContain('T5');
  });
});

describe('shouldSendAlert', () => {
  it('returns true when no recent alert exists for the ticker', () => {
    const result = shouldSendAlert('GME', 4 * 60 * 60 * 1000, []);
    expect(result).toBe(true);
  });

  it('returns false when a recent alert exists within the window', () => {
    const windowMs = 4 * 60 * 60 * 1000; // 4 hours
    const recentAlerts = [
      { ticker: 'GME', createdAt: Date.now() - 30 * 60 * 1000 }, // 30 min ago
    ];
    const result = shouldSendAlert('GME', windowMs, recentAlerts);
    expect(result).toBe(false);
  });

  it('returns true when alert exists but is older than window', () => {
    const windowMs = 4 * 60 * 60 * 1000; // 4 hours
    const recentAlerts = [
      { ticker: 'GME', createdAt: Date.now() - 5 * 60 * 60 * 1000 }, // 5 hours ago (outside 4h window)
    ];
    const result = shouldSendAlert('GME', windowMs, recentAlerts);
    expect(result).toBe(true);
  });

  it('returns true for different ticker when only the other ticker has recent alert', () => {
    const windowMs = 4 * 60 * 60 * 1000;
    const recentAlerts = [
      { ticker: 'AMC', createdAt: Date.now() - 30 * 60 * 1000 }, // 30 min ago for AMC
    ];
    // GME has no alert
    const result = shouldSendAlert('GME', windowMs, recentAlerts);
    expect(result).toBe(true);
  });

  it('returns false when multiple alerts exist and most recent is within window', () => {
    const windowMs = 4 * 60 * 60 * 1000;
    const recentAlerts = [
      { ticker: 'GME', createdAt: Date.now() - 5 * 60 * 60 * 1000 }, // old — outside window
      { ticker: 'GME', createdAt: Date.now() - 1 * 60 * 60 * 1000 }, // 1 hour ago — inside window
    ];
    const result = shouldSendAlert('GME', windowMs, recentAlerts);
    expect(result).toBe(false);
  });
});
