/**
 * Stock Card Component
 * Displays stock ticker with sentiment, mentions, and velocity
 */

'use client';

import Link from 'next/link';

interface StockCardProps {
  rank: number;
  ticker: string;
  mentionCount: number;
  sentimentScore: number;
  sentimentCategory: string;
  velocity: number;
  timestamp: number;
  type: 'trending' | 'fading';
}

export default function StockCard({
  rank,
  ticker,
  mentionCount,
  sentimentScore,
  sentimentCategory,
  velocity,
  type,
}: StockCardProps) {
  // Determine sentiment emoji and color
  const getSentimentDisplay = (category: string) => {
    switch (category) {
      case 'strong_bullish':
        return { emoji: '📈🚀', label: 'Strong Bullish', color: 'text-green-600' };
      case 'bullish':
        return { emoji: '📈', label: 'Bullish', color: 'text-green-500' };
      case 'bearish':
        return { emoji: '📉', label: 'Bearish', color: 'text-red-500' };
      case 'strong_bearish':
        return { emoji: '📉💥', label: 'Strong Bearish', color: 'text-red-600' };
      default:
        return { emoji: '➖', label: 'Neutral', color: 'text-gray-500' };
    }
  };

  const sentiment = getSentimentDisplay(sentimentCategory);
  const isPositiveVelocity = velocity > 0;

  return (
    <Link href={`/stock/${ticker}`}>
      <div className="bg-white rounded-lg shadow-sm hover:shadow-md transition-shadow p-6 border border-gray-200 cursor-pointer">
        {/* Header with rank and ticker */}
        <div className="flex items-start justify-between mb-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-sm font-medium text-gray-500">#{rank}</span>
              <h3 className="text-2xl font-bold text-gray-900">${ticker}</h3>
            </div>
            <p className={`text-sm font-medium ${sentiment.color}`}>
              {sentiment.emoji} {sentiment.label}
            </p>
          </div>

          {/* Velocity indicator */}
          <div className={`text-right ${isPositiveVelocity ? 'text-green-600' : 'text-red-600'}`}>
            <div className="flex items-center justify-end gap-1">
              <span className="text-2xl">{isPositiveVelocity ? '↑' : '↓'}</span>
              <span className="text-xl font-bold">
                {Math.abs(velocity).toFixed(0)}%
              </span>
            </div>
            <p className="text-xs text-gray-500 mt-1">
              {type === 'trending' ? 'Rising' : 'Fading'}
            </p>
          </div>
        </div>

        {/* Mention count */}
        <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-100">
          <div>
            <p className="text-sm text-gray-500">Mentions</p>
            <p className="text-lg font-semibold text-gray-900">{mentionCount.toLocaleString()}</p>
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
