'use client';

import { use, useEffect, useState } from 'react';
import Link from 'next/link';
import StockChart from '@/components/StockChart';
import CollapsibleSection from '@/components/CollapsibleSection';
import { detectCreatorSignal } from '@/lib/creators';
import type { LunarCrushCreator } from '@/types/lunarcrush';
import OptionsActivitySection from '@/components/OptionsActivitySection';

interface StockDetails {
  ticker: string;
  timestamp: number;
  mentionCount: number;
  uniquePosts: number;
  uniqueComments: number;
  avgSentimentScore: number;
  sentimentCategory: string;
  bullishCount: number;
  bearishCount: number;
  neutralCount: number;
  totalUpvotes: number;
  subredditBreakdown: Record<string, number>;
  topKeywords: string[];
}

interface Evidence {
  evidenceId: string;
  type: 'post' | 'comment';
  text: string;
  keywords: string[];
  sentimentScore: number;
  sentimentCategory: string;
  upvotes: number;
  subreddit: string;
  redditUrl?: string;
  createdAt: number;
}

interface StockEnrichment {
  price: number;
  volume_24h: number;
  percent_change_24h: number;
  social_dominance: number;
  galaxy_score: number;
  sentiment: number;
  engagements: number;
  mentions_cross_platform: number;
  engagements_by_network: Record<string, number>;
  top_creators?: LunarCrushCreator[];
}

interface PriceSnapshot {
  price: number;
  changePct24h: number;
  volume: number;
  dayHigh: number;
  dayLow: number;
  dayOpen: number;
  previousClose: number;
  staleness: 'fresh' | 'normal' | 'grey' | 'drop';
  fetchedAt: number;
}

interface OptionsActivityData {
  callOpenInterest: number;
  putOpenInterest: number;
  putCallRatio: number;
  iv30d: number | null;
}

interface PricePoint {
  timestamp: number;
  price: number;
  volume: number;
}

export default function StockDetailPage({ params }: { params: Promise<{ ticker: string }> }) {
  const { ticker: tickerParam } = use(params);
  const ticker = tickerParam.toUpperCase();
  const [isLoading, setIsLoading] = useState(true);
  const [stockDetails, setStockDetails] = useState<StockDetails | null>(null);
  const [evidence, setEvidence] = useState<Evidence[]>([]);
  const [history, setHistory] = useState<{
    mentions: { label: string; value: number }[];
    sentiment: { label: string; value: number }[];
  } | null>(null);
  const [timeBreakdown, setTimeBreakdown] = useState<{
    periods: { label: string; mentions: number; bullishPct: number; neutralPct: number; bearishPct: number }[];
  } | null>(null);
  const [enrichment, setEnrichment] = useState<StockEnrichment | null>(null);
  const [priceSnapshot, setPriceSnapshot] = useState<PriceSnapshot | null>(null);
  const [priceHistory, setPriceHistory] = useState<PricePoint[]>([]);
  const [options, setOptions] = useState<OptionsActivityData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    document.title = `${ticker} - Stock Details`;

    const fetchData = async () => {
      // Middleware (src/middleware.ts) protects /stock/:path* server-side — no client-side auth check needed.

      // Fetch stock details
      try {
        const response = await fetch(`/api/stocks/${ticker}`);
        const result = await response.json();

        if (result.success) {
          setStockDetails(result.data.details);
          setEvidence(result.data.evidence);
          if (result.data.history) {
            setHistory(result.data.history);
          }
          if (result.data.timeBreakdown) {
            setTimeBreakdown(result.data.timeBreakdown);
          }
          if (result.data.enrichment) {
            setEnrichment(result.data.enrichment);
          }
          if (result.data.priceSnapshot) {
            setPriceSnapshot(result.data.priceSnapshot);
          }
          if (result.data.priceHistory) {
            setPriceHistory(result.data.priceHistory);
          }
          if (result.data.options) {
            setOptions(result.data.options);
          }
        } else {
          setError(result.error || 'Stock not found');
        }
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Failed to load stock details');
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [ticker]);

  const getSentimentDisplay = (category: string) => {
    switch (category) {
      case 'strong_bullish':
        return { emoji: '📈🚀', label: 'Strong Bullish', color: 'text-green-700 bg-green-50' };
      case 'bullish':
        return { emoji: '📈', label: 'Bullish', color: 'text-green-700 bg-green-50' };
      case 'bearish':
        return { emoji: '📉', label: 'Bearish', color: 'text-red-700 bg-red-50' };
      case 'strong_bearish':
        return { emoji: '📉💥', label: 'Strong Bearish', color: 'text-red-700 bg-red-50' };
      default:
        return { emoji: '➖', label: 'Neutral', color: 'text-gray-500 bg-gray-50' };
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading stock details...</p>
        </div>
      </div>
    );
  }

  if (error || !stockDetails) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <Link
            href="/dashboard"
            className="inline-flex items-center min-h-[44px] text-purple-600 hover:text-purple-700 mb-6"
          >
            ← Back to Dashboard
          </Link>
          <div className="bg-red-50 border border-red-200 rounded-lg p-6">
            <h2 className="text-xl font-semibold text-red-900 mb-2">Error</h2>
            <p className="text-red-700">{error || 'Stock not found'}</p>
          </div>
        </div>
      </div>
    );
  }

  const sentiment = getSentimentDisplay(stockDetails.sentimentCategory);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <Link
            href="/dashboard"
            className="inline-flex items-center min-h-[44px] text-purple-600 hover:text-purple-700 mb-4"
          >
            ← Back to Dashboard
          </Link>
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
            <div>
              <h1 className="text-3xl sm:text-4xl font-bold text-gray-900">${ticker}</h1>
              <div className={`inline-flex items-center gap-2 mt-2 px-3 py-1 rounded-full ${sentiment.color}`}>
                <span className="text-xl">{sentiment.emoji}</span>
                <span className="font-medium">{sentiment.label}</span>
              </div>
            </div>
            <div className="flex flex-col items-end gap-2">
              <div className="text-right">
                <p className="text-sm text-gray-500">Sentiment Score</p>
                <p className={`text-2xl sm:text-3xl font-bold ${sentiment.color.split(' ')[0]}`}>
                  {stockDetails.avgSentimentScore.toFixed(2)}
                </p>
              </div>
              <a
                href={`/api/stocks/${ticker}/export?format=csv&range=30d`}
                download
                className="inline-flex items-center min-h-[44px] px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
              >
                Export CSV
              </a>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Statistics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 mb-6 sm:mb-8">
          <div className="bg-white rounded-lg shadow p-4 sm:p-6">
            <h3 className="text-sm font-medium text-gray-500 mb-2">Total Mentions</h3>
            <p className="text-3xl font-bold text-gray-900">{stockDetails.mentionCount.toLocaleString()}</p>
          </div>
          <div className="bg-white rounded-lg shadow p-4 sm:p-6">
            <h3 className="text-sm font-medium text-gray-500 mb-2">Unique Posts</h3>
            <p className="text-3xl font-bold text-gray-900">{stockDetails.uniquePosts.toLocaleString()}</p>
          </div>
          <div className="bg-white rounded-lg shadow p-4 sm:p-6">
            <h3 className="text-sm font-medium text-gray-500 mb-2">Comments</h3>
            <p className="text-3xl font-bold text-gray-900">{stockDetails.uniqueComments.toLocaleString()}</p>
          </div>
          <div className="bg-white rounded-lg shadow p-4 sm:p-6">
            <h3 className="text-sm font-medium text-gray-500 mb-2">Total Upvotes</h3>
            <p className="text-3xl font-bold text-gray-900">{stockDetails.totalUpvotes.toLocaleString()}</p>
          </div>
        </div>

        {/* Market Data — Finnhub price (primary) + LunarCrush social */}
        {(priceSnapshot || enrichment) && (
          <div className="bg-white rounded-lg shadow p-4 sm:p-6 mb-6 sm:mb-8">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Market Data</h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div>
                <p className="text-xs text-gray-500 mb-1">Price</p>
                <div className="flex items-center gap-1">
                  <p className={`text-xl font-bold ${priceSnapshot?.staleness === 'grey' ? 'text-gray-500' : 'text-gray-900'}`}>
                    ${(priceSnapshot?.price ?? enrichment?.price ?? 0).toFixed(2)}
                  </p>
                  {priceSnapshot?.staleness === 'grey' && (
                    <span title="stale price" className="text-sm text-gray-500">⏰</span>
                  )}
                </div>
              </div>
              <div>
                <p className="text-xs text-gray-500 mb-1">24h Change</p>
                {(() => {
                  const pct = priceSnapshot?.changePct24h ?? enrichment?.percent_change_24h;
                  return pct !== undefined ? (
                    <p className={`text-xl font-bold ${priceSnapshot?.staleness === 'grey' ? 'text-gray-500' : pct >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                      {pct >= 0 ? '+' : ''}{pct.toFixed(2)}%
                    </p>
                  ) : null;
                })()}
              </div>
              {enrichment && (
                <>
                  <div>
                    <p className="text-xs text-gray-500 mb-1">Social Dominance</p>
                    <p className="text-xl font-bold text-purple-700">{enrichment.social_dominance.toFixed(1)}%</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 mb-1">Cross-Platform Mentions</p>
                    <p className="text-xl font-bold text-gray-900">{enrichment.mentions_cross_platform.toLocaleString()}</p>
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {/* 7-Day Price Chart — from Finnhub price history */}
        {priceHistory.length >= 2 && (
          <div className="bg-white rounded-lg shadow p-4 sm:p-6 mb-6 sm:mb-8">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">7-Day Price History</h2>
            <div className="w-full overflow-x-auto" tabIndex={0}>
              {(() => {
                const prices = priceHistory.map(p => p.price);
                const volumes = priceHistory.map(p => p.volume);
                const minP = Math.min(...prices);
                const maxP = Math.max(...prices);
                const rangeP = maxP - minP || 1;
                const W = 600, H = 120, VH = 30, PAD = 4;
                const step = W / (prices.length - 1);
                const pts = prices.map((p, i) => `${i * step},${PAD + (1 - (p - minP) / rangeP) * (H - 2 * PAD)}`).join(' ');
                const maxV = Math.max(...volumes, 1);
                return (
                  <svg viewBox={`0 0 ${W} ${H + VH}`} className="w-full h-auto">
                    <polyline points={pts} fill="none" stroke="#7c3aed" strokeWidth="2" />
                    {volumes.map((v, i) => (
                      <rect
                        key={i}
                        x={i * step - 2}
                        y={H + VH - (v / maxV) * VH}
                        width={4}
                        height={(v / maxV) * VH}
                        fill="#7c3aed"
                        opacity={0.4}
                      />
                    ))}
                    <text x={0} y={H - 2} fontSize={10} fill="#9ca3af">${minP.toFixed(2)}</text>
                    <text x={0} y={PAD + 10} fontSize={10} fill="#9ca3af">${maxP.toFixed(2)}</text>
                  </svg>
                );
              })()}
            </div>
          </div>
        )}

        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          <StockChart
            data={history?.mentions || []}
            title="Mention Count (7 Days)"
            color="#7c3aed"
          />
          <StockChart
            data={history?.sentiment || []}
            title="Sentiment Score (7 Days)"
            color="#16a34a"
            valueFormatter={(v) => v.toFixed(2)}
          />
        </div>

        {/* Time Breakdown */}
        {timeBreakdown && timeBreakdown.periods.length > 0 && (
          <div className="bg-white rounded-lg shadow p-4 sm:p-6 mb-6 sm:mb-8">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Statistics by Time Period</h2>
            <div className="overflow-x-auto" tabIndex={0}>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th scope="col" className="text-left py-3 px-4 font-medium text-gray-500">Period</th>
                    <th scope="col" className="text-right py-3 px-4 font-medium text-gray-500">Mentions</th>
                    <th scope="col" className="text-right py-3 px-4 font-medium text-green-700">Bullish %</th>
                    <th scope="col" className="text-right py-3 px-4 font-medium text-gray-500">Neutral %</th>
                    <th scope="col" className="text-right py-3 px-4 font-medium text-red-700">Bearish %</th>
                  </tr>
                </thead>
                <tbody>
                  {timeBreakdown.periods.map((period) => (
                    <tr key={period.label} className="border-b border-gray-100">
                      <td className="py-3 px-4 font-medium text-gray-900">{period.label}</td>
                      <td className="py-3 px-4 text-right text-gray-900">{period.mentions.toLocaleString()}</td>
                      <td className="py-3 px-4 text-right text-green-700">{period.bullishPct}%</td>
                      <td className="py-3 px-4 text-right text-gray-600">{period.neutralPct}%</td>
                      <td className="py-3 px-4 text-right text-red-700">{period.bearishPct}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Sentiment Breakdown */}
          <CollapsibleSection title="Sentiment Breakdown">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-green-700 font-medium">📈 Bullish</span>
                <span className="text-gray-900 font-semibold">{stockDetails.bullishCount} mentions</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-600 font-medium">➖ Neutral</span>
                <span className="text-gray-900 font-semibold">{stockDetails.neutralCount} mentions</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-red-700 font-medium">📉 Bearish</span>
                <span className="text-gray-900 font-semibold">{stockDetails.bearishCount} mentions</span>
              </div>
            </div>
          </CollapsibleSection>

          {/* Subreddit Breakdown */}
          <CollapsibleSection title="Subreddit Breakdown">
            <div className="space-y-3">
              {Object.entries(stockDetails.subredditBreakdown)
                .sort(([, a], [, b]) => b - a)
                .map(([subreddit, count]) => (
                  <div key={subreddit} className="flex items-center justify-between">
                    <span className="text-gray-700">r/{subreddit}</span>
                    <span className="text-gray-900 font-semibold">{count} mentions</span>
                  </div>
                ))}
            </div>
          </CollapsibleSection>
        </div>

        {/* Cross-Platform Activity — engagements by network */}
        {enrichment && Object.keys(enrichment.engagements_by_network).length > 0 && (
          <div className="mt-8">
            <CollapsibleSection title="Cross-Platform Activity">
              <div className="space-y-3">
                {(() => {
                  const total = Object.values(enrichment.engagements_by_network).reduce((a, b) => a + b, 0);
                  return Object.entries(enrichment.engagements_by_network)
                    .sort(([, a], [, b]) => b - a)
                    .map(([network, engagements]) => (
                      <div key={network}>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm text-gray-700 capitalize">{network}</span>
                          <span className="text-sm font-medium text-gray-900">{engagements.toLocaleString()}</span>
                        </div>
                        <div className="w-full bg-gray-100 rounded-full h-2">
                          <div
                            className="bg-purple-500 h-2 rounded-full"
                            style={{ width: total > 0 ? `${(engagements / total) * 100}%` : '0%' }}
                          />
                        </div>
                      </div>
                    ));
                })()}
              </div>
            </CollapsibleSection>
          </div>
        )}

        {/* Top Keywords */}
        {stockDetails.topKeywords.length > 0 && (
          <div className="mt-8">
            <CollapsibleSection title="Top Keywords">
              <div className="flex flex-wrap gap-2">
                {stockDetails.topKeywords.map((keyword, index) => (
                  <span
                    key={index}
                    className="px-3 py-1 bg-purple-100 text-purple-700 rounded-full text-sm font-medium"
                  >
                    {keyword}
                  </span>
                ))}
              </div>
            </CollapsibleSection>
          </div>
        )}

        {/* Notable Creators */}
        {enrichment?.top_creators && enrichment.top_creators.length > 0 && (
          <div className="mt-8">
            <CollapsibleSection title="Notable Creators">
              <div className="space-y-3">
                {enrichment.top_creators.map((creator, i) => {
                  const isNotable = detectCreatorSignal([creator]);
                  return (
                    <div key={i} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-gray-900">@{creator.screen_name}</span>
                          {isNotable && (
                            <span className="text-xs px-1.5 py-0.5 bg-orange-100 text-orange-700 rounded font-semibold">Notable</span>
                          )}
                        </div>
                        <p className="text-xs text-gray-500 capitalize">{creator.network} · Rank #{creator.influencer_rank}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-semibold text-gray-900">{creator.followers >= 1_000_000 ? `${(creator.followers / 1_000_000).toFixed(1)}M` : creator.followers >= 1_000 ? `${(creator.followers / 1_000).toFixed(0)}K` : creator.followers} followers</p>
                        <p className="text-xs text-gray-500">{creator.engagements.toLocaleString()} engagements</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CollapsibleSection>
          </div>
        )}

        {/* Options Activity */}
        {options && (
          <div className="mt-8">
            <OptionsActivitySection options={options} />
          </div>
        )}

        {/* Supporting Evidence */}
        {evidence.length > 0 && (
          <div className="mt-8">
            <CollapsibleSection title={`Supporting Evidence (Top ${evidence.length} mentions by upvotes)`}>
            <div className="space-y-6">
              {evidence.map((item) => {
                const itemSentiment = getSentimentDisplay(item.sentimentCategory);
                return (
                  <div key={item.evidenceId} className="border border-gray-200 rounded-lg p-4">
                    <div className="flex items-start justify-between mb-2 flex-wrap gap-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`px-2 py-1 rounded text-xs font-medium ${itemSentiment.color}`}>
                          {itemSentiment.emoji} {itemSentiment.label}
                        </span>
                        <span className="text-sm text-gray-500">
                          {item.type === 'post' ? '📄 Post' : '💬 Comment'}
                        </span>
                        <span className="text-sm text-gray-500">r/{item.subreddit}</span>
                      </div>
                      <span className="text-sm text-gray-500">⬆️ {item.upvotes}</span>
                    </div>
                    <p className="text-gray-700 mb-2 whitespace-pre-wrap break-words">{item.text}</p>
                    {item.keywords.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {item.keywords.map((keyword, idx) => (
                          <span
                            key={idx}
                            className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded text-xs"
                          >
                            {keyword}
                          </span>
                        ))}
                      </div>
                    )}
                    {item.redditUrl && (
                      <div className="mt-2">
                        <a
                          href={item.redditUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center min-h-[44px] text-xs text-blue-600 hover:text-blue-800 hover:underline"
                        >
                          View on Reddit →
                        </a>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            </CollapsibleSection>
          </div>
        )}
      </main>
    </div>
  );
}
