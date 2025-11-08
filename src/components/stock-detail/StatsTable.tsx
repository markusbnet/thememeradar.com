/**
 * Stats Table Component
 * Displays statistics about stock mentions
 */

interface StockCurrent {
  timestamp: number;
  mentionCount: number;
  uniquePosts: number;
  uniqueComments: number;
  sentimentScore: number;
  sentimentCategory: string;
  bullishCount: number;
  bearishCount: number;
  neutralCount: number;
  totalUpvotes: number;
  subredditBreakdown: Record<string, number>;
  topKeywords: string[];
}

interface HistoricalData {
  timestamp: number;
  mentionCount: number;
  sentimentScore: number;
}

interface StatsTableProps {
  current: StockCurrent;
  historical: HistoricalData[];
}

function calculate24hMentions(historical: HistoricalData[]): number {
  const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
  return historical
    .filter(h => h.timestamp >= oneDayAgo)
    .reduce((sum, h) => sum + h.mentionCount, 0);
}

function calculate7dMentions(historical: HistoricalData[]): number {
  return historical.reduce((sum, h) => sum + h.mentionCount, 0);
}

function getTopSubreddit(breakdown: Record<string, number>): string {
  const entries = Object.entries(breakdown);
  if (entries.length === 0) return 'N/A';

  const sorted = entries.sort((a, b) => b[1] - a[1]);
  return `r/${sorted[0][0]} (${sorted[0][1]} mentions)`;
}

export default function StatsTable({ current, historical }: StatsTableProps) {
  const mentions24h = calculate24hMentions(historical);
  const mentions7d = calculate7dMentions(historical);

  const totalMentions = current.bullishCount + current.bearishCount + current.neutralCount;
  const bullishPercent = totalMentions > 0 ? (current.bullishCount / totalMentions) * 100 : 0;
  const bearishPercent = totalMentions > 0 ? (current.bearishCount / totalMentions) * 100 : 0;
  const neutralPercent = totalMentions > 0 ? (current.neutralCount / totalMentions) * 100 : 0;

  const topSubreddit = getTopSubreddit(current.subredditBreakdown);

  return (
    <div className="rounded-lg bg-white shadow">
      <div className="px-6 py-5">
        <h2 className="text-lg font-semibold text-gray-900">Statistics</h2>
      </div>

      <div className="border-t border-gray-200">
        <dl className="divide-y divide-gray-200">
          {/* Mention Counts */}
          <div className="px-6 py-4 sm:grid sm:grid-cols-3 sm:gap-4">
            <dt className="text-sm font-medium text-gray-500">Total Mentions</dt>
            <dd className="mt-1 text-sm text-gray-900 sm:col-span-2 sm:mt-0">
              <div className="space-y-1">
                <div>15 min: {current.mentionCount.toLocaleString()}</div>
                <div>24 hr: {mentions24h.toLocaleString()}</div>
                <div>7 days: {mentions7d.toLocaleString()}</div>
              </div>
            </dd>
          </div>

          {/* Post/Comment Breakdown */}
          <div className="px-6 py-4 sm:grid sm:grid-cols-3 sm:gap-4">
            <dt className="text-sm font-medium text-gray-500">Sources</dt>
            <dd className="mt-1 text-sm text-gray-900 sm:col-span-2 sm:mt-0">
              {current.uniquePosts} posts, {current.uniqueComments} comments
            </dd>
          </div>

          {/* Sentiment Breakdown */}
          <div className="px-6 py-4 sm:grid sm:grid-cols-3 sm:gap-4">
            <dt className="text-sm font-medium text-gray-500">Sentiment Breakdown</dt>
            <dd className="mt-1 text-sm text-gray-900 sm:col-span-2 sm:mt-0">
              <div className="space-y-2">
                {/* Bullish */}
                <div>
                  <div className="flex justify-between text-xs">
                    <span className="text-green-700">Bullish</span>
                    <span className="text-gray-600">{bullishPercent.toFixed(1)}%</span>
                  </div>
                  <div className="mt-1 h-2 w-full rounded-full bg-gray-200">
                    <div
                      className="h-2 rounded-full bg-green-500"
                      style={{ width: `${bullishPercent}%` }}
                    />
                  </div>
                </div>

                {/* Neutral */}
                <div>
                  <div className="flex justify-between text-xs">
                    <span className="text-gray-700">Neutral</span>
                    <span className="text-gray-600">{neutralPercent.toFixed(1)}%</span>
                  </div>
                  <div className="mt-1 h-2 w-full rounded-full bg-gray-200">
                    <div
                      className="h-2 rounded-full bg-gray-400"
                      style={{ width: `${neutralPercent}%` }}
                    />
                  </div>
                </div>

                {/* Bearish */}
                <div>
                  <div className="flex justify-between text-xs">
                    <span className="text-red-700">Bearish</span>
                    <span className="text-gray-600">{bearishPercent.toFixed(1)}%</span>
                  </div>
                  <div className="mt-1 h-2 w-full rounded-full bg-gray-200">
                    <div
                      className="h-2 rounded-full bg-red-500"
                      style={{ width: `${bearishPercent}%` }}
                    />
                  </div>
                </div>
              </div>
            </dd>
          </div>

          {/* Total Upvotes */}
          <div className="px-6 py-4 sm:grid sm:grid-cols-3 sm:gap-4">
            <dt className="text-sm font-medium text-gray-500">Total Upvotes</dt>
            <dd className="mt-1 text-sm text-gray-900 sm:col-span-2 sm:mt-0">
              {current.totalUpvotes.toLocaleString()}
            </dd>
          </div>

          {/* Top Subreddit */}
          <div className="px-6 py-4 sm:grid sm:grid-cols-3 sm:gap-4">
            <dt className="text-sm font-medium text-gray-500">Top Subreddit</dt>
            <dd className="mt-1 text-sm text-gray-900 sm:col-span-2 sm:mt-0">
              {topSubreddit}
            </dd>
          </div>

          {/* Top Keywords */}
          <div className="px-6 py-4 sm:grid sm:grid-cols-3 sm:gap-4">
            <dt className="text-sm font-medium text-gray-500">Top Keywords</dt>
            <dd className="mt-1 text-sm text-gray-900 sm:col-span-2 sm:mt-0">
              <div className="flex flex-wrap gap-2">
                {current.topKeywords.slice(0, 10).map((keyword) => (
                  <span
                    key={keyword}
                    className="inline-flex items-center rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-medium text-blue-800"
                  >
                    {keyword}
                  </span>
                ))}
              </div>
            </dd>
          </div>

          {/* Subreddit Distribution */}
          <div className="px-6 py-4 sm:grid sm:grid-cols-3 sm:gap-4">
            <dt className="text-sm font-medium text-gray-500">Subreddit Distribution</dt>
            <dd className="mt-1 text-sm text-gray-900 sm:col-span-2 sm:mt-0">
              <div className="space-y-1">
                {Object.entries(current.subredditBreakdown)
                  .sort((a, b) => b[1] - a[1])
                  .map(([subreddit, count]) => (
                    <div key={subreddit} className="flex justify-between">
                      <span>r/{subreddit}</span>
                      <span className="text-gray-600">{count}</span>
                    </div>
                  ))}
              </div>
            </dd>
          </div>
        </dl>
      </div>
    </div>
  );
}
