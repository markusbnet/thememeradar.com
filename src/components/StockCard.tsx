/**
 * Stock Card Component
 * Displays stock ticker with sentiment, mentions, and velocity
 */

'use client';

import Link from 'next/link';
import Sparkline from './Sparkline';

interface StockCardProps {
  rank: number;
  ticker: string;
  mentionCount: number;
  mentionsPrev?: number;
  mentionDelta?: number;
  sentimentScore: number;
  sentimentCategory: string;
  velocity: number;
  timestamp: number;
  type: 'trending' | 'fading';
  sparklineData?: number[];
  rankDelta24h?: number | null;
  rankStatus?: 'climbing' | 'falling' | 'new' | 'steady' | 'unknown';
  // Optional enrichment data from LunarCrush
  price?: number;
  changePct24h?: number;
  socialDominance?: number;
  // Finnhub price staleness (fresh/normal = normal color, grey = muted, drop = hide)
  staleness?: 'fresh' | 'normal' | 'grey' | 'drop';
  // ApeWisdom coverage source badge
  coverageSource?: 'reddit' | 'apewisdom' | 'both';
}

export default function StockCard({
  rank,
  ticker,
  mentionCount,
  mentionsPrev,
  mentionDelta,
  sentimentScore,
  sentimentCategory,
  velocity,
  type,
  sparklineData,
  rankDelta24h,
  rankStatus,
  price,
  changePct24h,
  socialDominance,
  staleness,
  coverageSource,
}: StockCardProps) {
  // Determine sentiment emoji and color
  const getSentimentDisplay = (category: string) => {
    switch (category) {
      case 'strong_bullish':
        return { emoji: '📈🚀', label: 'Strong Bullish', color: 'text-green-700' };
      case 'bullish':
        return { emoji: '📈', label: 'Bullish', color: 'text-green-700' };
      case 'bearish':
        return { emoji: '📉', label: 'Bearish', color: 'text-red-700' };
      case 'strong_bearish':
        return { emoji: '📉💥', label: 'Strong Bearish', color: 'text-red-700' };
      default:
        return { emoji: '➖', label: 'Neutral', color: 'text-gray-500' };
    }
  };

  const sentiment = getSentimentDisplay(sentimentCategory);
  const isPositiveVelocity = velocity > 0;
  // First-appearance ticker: velocity is pinned at 100% by storage because
  // there's no previous window to compare against. Show "NEW" instead so we
  // don't mislead users into thinking a brand-new ticker just surged 100%.
  const isNewTicker = mentionsPrev === 0;

  return (
    <Link href={`/stock/${ticker}`}>
      <div className="bg-white rounded-lg shadow-sm hover:shadow-md transition-shadow p-4 sm:p-6 border border-gray-200 cursor-pointer">
        {/* Header with rank and ticker */}
        <div className="flex items-start justify-between mb-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-sm font-medium text-gray-500">#{rank}</span>
              <h3 className="text-xl sm:text-2xl font-bold text-gray-900">${ticker}</h3>
              {rankStatus === 'new' && (
                <span className="text-xs font-bold px-1.5 py-0.5 rounded bg-purple-100 text-purple-700">NEW</span>
              )}
              {coverageSource === 'both' && (
                <span title="tracked by Reddit + ApeWisdom" className="text-xs font-bold px-1.5 py-0.5 rounded bg-blue-100 text-blue-700">AW+</span>
              )}
              {coverageSource === 'apewisdom' && (
                <span title="ApeWisdom-only signal" className="text-xs font-bold px-1.5 py-0.5 rounded bg-gray-100 text-gray-600">AW</span>
              )}
              {(rankStatus === 'climbing' || rankStatus === 'falling') && rankDelta24h !== null && rankDelta24h !== undefined && (
                <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${rankDelta24h > 0 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                  {rankDelta24h > 0 ? `↑${rankDelta24h}` : `↓${Math.abs(rankDelta24h)}`}
                </span>
              )}
            </div>
            <p className={`text-sm font-medium ${sentiment.color}`}>
              {sentiment.emoji} {sentiment.label}
            </p>
          </div>

          {/* Velocity indicator */}
          <div className={`text-right ${isNewTicker ? 'text-purple-600' : isPositiveVelocity ? 'text-green-700' : 'text-red-700'}`}>
            <div className="flex items-center justify-end gap-1">
              {isNewTicker ? (
                <span className="text-lg sm:text-xl font-bold">NEW</span>
              ) : (
                <>
                  <span className="text-lg sm:text-2xl">{isPositiveVelocity ? '↑' : '↓'}</span>
                  <span className="text-lg sm:text-xl font-bold">
                    {Math.abs(velocity).toFixed(0)}%
                  </span>
                </>
              )}
            </div>
            <p className="text-xs text-gray-500 mt-1">
              {isNewTicker ? 'First seen' : type === 'trending' ? 'Rising' : 'Fading'}
            </p>
          </div>
        </div>

        {/* Sparkline chart */}
        {sparklineData && sparklineData.length >= 2 && (
          <div className="mt-3 flex justify-center">
            <Sparkline
              data={sparklineData}
              width={200}
              height={40}
              color={isPositiveVelocity ? '#16a34a' : '#dc2626'}
              fillColor={isPositiveVelocity ? 'rgba(22, 163, 74, 0.1)' : 'rgba(220, 38, 38, 0.1)'}
            />
          </div>
        )}

        {/* Enrichment: price + social dominance (hidden when staleness is 'drop' or price is missing) */}
        {price != null && staleness !== 'drop' && (
          <div className="mt-3 pt-3 border-t border-gray-100">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-500">Price</p>
                <div className="flex items-center gap-1">
                  <p className={`text-sm font-semibold ${staleness === 'grey' ? 'text-gray-500' : 'text-gray-900'}`}>
                    ${price.toFixed(2)}
                  </p>
                  {staleness === 'grey' && (
                    <span title="stale price" className="text-xs text-gray-500">⏰</span>
                  )}
                </div>
              </div>
              {changePct24h != null && (
                <div className="text-right">
                  <p className="text-xs text-gray-500">24h</p>
                  <p className={`text-sm font-semibold ${staleness === 'grey' ? 'text-gray-500' : changePct24h >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                    {changePct24h >= 0 ? '+' : ''}{changePct24h.toFixed(2)}%
                  </p>
                </div>
              )}
              {socialDominance != null && (
                <div className="text-right">
                  <p className="text-xs text-gray-500">Social</p>
                  <p className="text-sm font-semibold text-purple-600">{socialDominance.toFixed(1)}%</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Mention count + delta */}
        <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-100">
          <div>
            <p className="text-sm text-gray-500">Mentions</p>
            <div className="flex flex-col sm:flex-row sm:items-baseline sm:gap-2">
              <p className="text-lg font-semibold text-gray-900">{mentionCount.toLocaleString()}</p>
              {mentionDelta !== undefined && mentionsPrev !== undefined && (
                <p className={`text-xs font-medium ${mentionDelta >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                  {mentionsPrev === 0
                    ? 'NEW'
                    : `${mentionDelta >= 0 ? '+' : ''}${mentionDelta.toLocaleString()} vs prev`}
                </p>
              )}
            </div>
          </div>
          <div className="text-right">
            <p className="text-sm text-gray-500">Sentiment Score</p>
            <p className={`text-lg font-semibold ${sentiment.color}`}>
              {sentimentScore.toFixed(2)}
            </p>
          </div>
        </div>

        {/* Click indicator */}
        <div className="mt-4 text-sm text-purple-600 font-medium flex items-center justify-center gap-1">
          View details →
        </div>
      </div>
    </Link>
  );
}
