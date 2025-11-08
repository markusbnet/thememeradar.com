/**
 * Stock Header Component
 * Displays ticker symbol, sentiment, and key metrics
 */

interface StockHeaderProps {
  ticker: string;
  sentimentScore: number;
  sentimentCategory: string;
  mentionCount: number;
}

function getSentimentEmoji(category: string): string {
  const emojiMap: Record<string, string> = {
    strong_bullish: '🚀',
    bullish: '📈',
    neutral: '➡️',
    bearish: '📉',
    strong_bearish: '💥',
  };
  return emojiMap[category] || '❓';
}

function getSentimentLabel(category: string): string {
  const labelMap: Record<string, string> = {
    strong_bullish: 'Strong Bullish',
    bullish: 'Bullish',
    neutral: 'Neutral',
    bearish: 'Bearish',
    strong_bearish: 'Strong Bearish',
  };
  return labelMap[category] || 'Unknown';
}

function getSentimentColor(category: string): string {
  const colorMap: Record<string, string> = {
    strong_bullish: 'text-green-600',
    bullish: 'text-green-500',
    neutral: 'text-gray-500',
    bearish: 'text-red-500',
    strong_bearish: 'text-red-600',
  };
  return colorMap[category] || 'text-gray-500';
}

export default function StockHeader({
  ticker,
  sentimentScore,
  sentimentCategory,
  mentionCount,
}: StockHeaderProps) {
  const emoji = getSentimentEmoji(sentimentCategory);
  const label = getSentimentLabel(sentimentCategory);
  const color = getSentimentColor(sentimentCategory);

  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      {/* Ticker */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">
          ${ticker}
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          {mentionCount.toLocaleString()} mention{mentionCount !== 1 ? 's' : ''} in last 15 minutes
        </p>
      </div>

      {/* Sentiment */}
      <div className="flex items-center gap-3">
        <div className="text-4xl">{emoji}</div>
        <div>
          <div className={`text-lg font-semibold ${color}`}>{label}</div>
          <div className="text-sm text-gray-500">
            Score: {sentimentScore.toFixed(3)}
          </div>
        </div>
      </div>
    </div>
  );
}
