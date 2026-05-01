'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { checkAuth, logout, type User } from '@/lib/auth/client';
import StockCard from '@/components/StockCard';
import StockTable from '@/components/StockTable';
import ViewToggle from '@/components/ViewToggle';
import OpportunityCard from '@/components/OpportunityCard';
import RefreshTimer from '@/components/RefreshTimer';
import PipelineStatus from '@/components/PipelineStatus';
import SurgeAlert from '@/components/SurgeAlert';
import TimeframeSelector from '@/components/TimeframeSelector';
import type { SurgeStock } from '@/lib/db/surge';
import type { OpportunityScore } from '@/lib/opportunity-score';
import type { Timeframe } from '@/lib/db/storage';

interface TrendingStock {
  ticker: string;
  mentionCount: number;
  mentionsPrev?: number;
  mentionDelta?: number;
  sentimentScore: number;
  sentimentCategory: string;
  velocity: number;
  timestamp: number;
  sparklineData?: number[];
  rankDelta24h?: number | null;
  rankStatus?: 'climbing' | 'falling' | 'new' | 'steady' | 'unknown';
  enrichment?: {
    price: number;
    percent_change_24h: number;
    social_dominance: number;
  } | null;
  price?: {
    price: number;
    changePct24h: number;
    staleness: 'fresh' | 'normal' | 'grey' | 'drop';
  } | null;
  coverageSource?: 'reddit' | 'apewisdom' | 'both';
}

interface StockData {
  trending: TrendingStock[];
  fading: TrendingStock[];
  timestamp: number;
}

const VALID_TIMEFRAMES: Timeframe[] = ['1h', '4h', '24h', '7d'];

export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [stockData, setStockData] = useState<StockData | null>(null);
  const [surgeData, setSurgeData] = useState<SurgeStock[]>([]);
  const [opportunities, setOpportunities] = useState<OpportunityScore[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [timeframe, setTimeframe] = useState<Timeframe>('24h');
  const [view, setView] = useState<'cards' | 'table'>('cards');
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    document.title = 'Dashboard - The Meme Radar';

    // Check authentication on mount
    const verifyAuth = async () => {
      let authenticated = false;
      let userData: User | undefined;

      try {
        const result = await checkAuth();
        authenticated = result.authenticated;
        userData = result.user;
      } catch {
        // Network error or fetch aborted by navigation — bail without redirecting.
        // The middleware handles server-side protection; a transient fetch failure
        // should not log the user out mid-session.
        return;
      }

      if (cancelled) return;

      if (!authenticated) {
        router.push('/login');
        return;
      }

      setUser(userData || null);
      setIsLoading(false);

      // Read initial timeframe and view from URL
      const params = new URLSearchParams(window.location.search);
      const tfParam = params.get('timeframe');
      const initialTf: Timeframe =
        tfParam && (VALID_TIMEFRAMES as string[]).includes(tfParam)
          ? (tfParam as Timeframe)
          : '24h';

      if (initialTf !== '24h') {
        setTimeframe(initialTf);
      }

      const viewParam = params.get('view');
      if (viewParam === 'table') {
        setView('table');
      }

      if (cancelled) return;

      // Fetch stock data, surge data, and opportunities in parallel
      await Promise.all([fetchStockData(initialTf), fetchSurgeData(), fetchOpportunities()]);
    };

    verifyAuth();
    return () => { cancelled = true; };
  }, [router]); // eslint-disable-line react-hooks/exhaustive-deps

  const fetchStockData = async (tf: Timeframe = timeframe) => {
    try {
      const response = await fetch(`/api/stocks/trending?timeframe=${tf}`);
      const result = await response.json();

      if (result.success) {
        setStockData(result.data);
        setError(null);
      } else {
        setError(result.error || 'Failed to fetch stock data');
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Network error');
    }
  };

  const fetchSurgeData = async () => {
    try {
      const response = await fetch('/api/stocks/surging');
      const result = await response.json();
      if (result.success) {
        setSurgeData(result.data.surging || []);
      }
    } catch {
      // Surge data is non-critical; silently ignore failures
    }
  };

  const fetchOpportunities = async () => {
    try {
      const response = await fetch('/api/stocks/opportunities');
      const result = await response.json();
      if (result.success) {
        setOpportunities(result.data.opportunities || []);
      }
    } catch {
      // Opportunities are non-critical; silently ignore failures
    }
  };

  const handleTimeframeChange = (tf: Timeframe) => {
    setTimeframe(tf);
    const params = new URLSearchParams(window.location.search);
    params.set('timeframe', tf);
    window.history.replaceState({}, '', `?${params.toString()}`);
    fetchStockData(tf);
  };

  const handleViewChange = (v: 'cards' | 'table') => {
    setView(v);
    const params = new URLSearchParams(window.location.search);
    if (v === 'table') {
      params.set('view', 'table');
    } else {
      params.delete('view');
    }
    window.history.replaceState({}, '', `?${params.toString()}`);
  };

  const handleRefresh = async () => {
    setRefreshKey(k => k + 1);
    await Promise.all([fetchStockData(timeframe), fetchSurgeData(), fetchOpportunities()]);
  };

  const handleLogout = async () => {
    const success = await logout();
    if (success) {
      router.push('/login');
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-gray-900">The Meme Radar</h1>
              <p className="text-sm text-gray-500 mt-1">
                Track meme stock trends from Reddit communities
              </p>
            </div>
            <div className="flex items-center gap-4">
              <span data-testid="pipeline-status-region"><PipelineStatus refreshKey={refreshKey} /></span>
              <span data-testid="refresh-timer-region"><RefreshTimer onRefresh={handleRefresh} /></span>
              <button
                onClick={handleLogout}
                className="px-4 py-2 min-h-[44px] bg-purple-600 hover:bg-purple-700 text-white text-sm rounded-md transition"
              >
                Log Out
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Welcome Message */}
      {user && (
        <div className="bg-white border-b border-gray-200">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
            <p className="text-gray-600">
              Welcome back, <span className="font-medium text-gray-900">{user.email}</span>
            </p>
          </div>
        </div>
      )}

      {/* How It Works Section */}
      <div className="bg-gradient-to-r from-purple-50 to-blue-50 border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-3">How Trends Are Calculated</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
            <div className="bg-white rounded-lg p-4 shadow-sm">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-2xl">📊</span>
                <h3 className="font-semibold text-gray-900">Data Collection</h3>
              </div>
              <p className="text-gray-600">
                Scans Reddit every <span className="font-medium text-purple-600">5 minutes</span> from r/wallstreetbets, r/stocks, and r/investing. Mentions are grouped into 15-minute buckets.
              </p>
            </div>

            <div className="bg-white rounded-lg p-4 shadow-sm">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-2xl">📈</span>
                <h3 className="font-semibold text-gray-900">Trending Algorithm</h3>
              </div>
              <p className="text-gray-600">
                Ranked by <span className="font-medium text-purple-600">velocity</span> &mdash; the % change in mentions vs. the previous 15-minute window. Stocks need at least 5 mentions to qualify. Surge alerts trigger at 3x the 1-hour baseline.
              </p>
            </div>

            <div className="bg-white rounded-lg p-4 shadow-sm">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-2xl">💭</span>
                <h3 className="font-semibold text-gray-900">Sentiment Analysis</h3>
              </div>
              <p className="text-gray-600">
                Scores text using weighted WSB keywords (🚀 &ldquo;to the moon&rdquo;, 💎🙌 &ldquo;diamond hands&rdquo;, 📄 &ldquo;paper hands&rdquo;). 10 points of signal = maximum score. Click any stock to see the evidence.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4">
            <p className="text-red-700 text-sm">{error}</p>
          </div>
        )}

        {/* Surge Alert */}
        <div data-testid="surge-alert-region"><SurgeAlert stocks={surgeData} /></div>

        {/* Opportunities Section — only shown when signal-qualifying stocks exist */}
        {opportunities.length > 0 && (
          <section className="mb-12" data-testid="opportunities-section">
            <div className="flex items-center mb-6">
              <h2 className="text-xl font-semibold text-gray-900">
                🎯 Opportunities
              </h2>
              <span className="ml-3 text-sm text-gray-500">
                {opportunities.length} signal{opportunities.length !== 1 ? 's' : ''}
              </span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-6">
              {opportunities.slice(0, 10).map((opp, index) => (
                <OpportunityCard
                  key={opp.ticker}
                  opportunity={opp}
                  rank={index + 1}
                />
              ))}
            </div>
          </section>
        )}

        {/* Timeframe Selector + View Toggle */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            <div className="text-sm text-gray-500">
              Showing data for the last <span className="font-medium text-gray-700">{timeframe}</span>
            </div>
            <TimeframeSelector value={timeframe} onChange={handleTimeframeChange} />
          </div>
          <ViewToggle view={view} onChange={handleViewChange} />
        </div>

        {/* Data gap notice — shown when we have trending stocks but no previous-window baseline yet.
            This happens briefly after a database reset or initial deployment; resolves within 24–48h. */}
        {stockData && stockData.trending.length > 0 && stockData.trending.every(s => (s.mentionsPrev ?? 0) === 0) && (
          <div className="mb-6 bg-blue-50 border border-blue-200 rounded-lg p-4 flex items-start gap-3" data-testid="data-gap-notice">
            <span className="text-blue-500 text-lg mt-0.5">ℹ️</span>
            <div>
              <p className="text-blue-800 text-sm font-medium">Building historical baseline</p>
              <p className="text-blue-700 text-sm mt-0.5">
                Velocity comparisons for the <span className="font-medium">{timeframe}</span> window need ~{timeframe === '1h' ? '1 hour' : timeframe === '4h' ? '4 hours' : timeframe === '7d' ? '7 days' : '24 hours'} of history to be meaningful.
                Stocks are ranked by mention volume for now.
                {timeframe !== '1h' && <span> Switch to <button className="underline font-medium" onClick={() => handleTimeframeChange('1h')}>1h</button> to see live velocity data.</span>}
              </p>
            </div>
          </div>
        )}

        {/* Trending Stocks Section */}
        <section className="mb-12">
          <div className="flex items-center mb-6">
            <h2 className="text-xl font-semibold text-gray-900">
              📈 Top 10 Trending (Rising)
            </h2>
            <span className="ml-3 text-sm text-gray-500">
              {stockData?.trending?.length || 0} stocks
            </span>
          </div>

          {!stockData || stockData.trending.length === 0 ? (
            <div className="bg-white rounded-lg shadow p-8 text-center">
              <p className="text-gray-500">
                No trending stocks found. Waiting for first scan to complete...
              </p>
              <p className="text-sm text-gray-500 mt-2">
                The background scanner runs every 5 minutes
              </p>
            </div>
          ) : view === 'table' ? (
            <StockTable stocks={stockData.trending.map(s => ({
              ...s,
              price: s.price?.price ?? s.enrichment?.price,
              changePct24h: s.price?.changePct24h ?? s.enrichment?.percent_change_24h,
              staleness: s.price?.staleness,
            }))} type="trending" />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-6">
              {stockData.trending.map((stock, index) => (
                <StockCard
                  key={stock.ticker}
                  rank={index + 1}
                  ticker={stock.ticker}
                  mentionCount={stock.mentionCount}
                  mentionsPrev={stock.mentionsPrev}
                  mentionDelta={stock.mentionDelta}
                  sentimentScore={stock.sentimentScore}
                  sentimentCategory={stock.sentimentCategory}
                  velocity={stock.velocity}
                  timestamp={stock.timestamp}
                  type="trending"
                  sparklineData={stock.sparklineData}
                  rankDelta24h={stock.rankDelta24h}
                  rankStatus={stock.rankStatus}
                  price={stock.price?.price ?? stock.enrichment?.price}
                  changePct24h={stock.price?.changePct24h ?? stock.enrichment?.percent_change_24h}
                  socialDominance={stock.enrichment?.social_dominance}
                  staleness={stock.price?.staleness}
                  coverageSource={stock.coverageSource}
                />
              ))}
            </div>
          )}
        </section>

        {/* Fading Stocks Section */}
        <section>
          <div className="flex items-center mb-6">
            <h2 className="text-xl font-semibold text-gray-900">
              📉 Top 10 Fading (Losing Interest)
            </h2>
            <span className="ml-3 text-sm text-gray-500">
              {stockData?.fading?.length || 0} stocks
            </span>
          </div>

          {!stockData || stockData.fading.length === 0 ? (
            <div className="bg-white rounded-lg shadow p-8 text-center">
              {stockData && stockData.trending.length > 0 && stockData.trending.every(s => (s.mentionsPrev ?? 0) === 0) ? (
                <>
                  <p className="text-gray-600 font-medium">No comparison data yet for the {timeframe} window</p>
                  <p className="text-sm text-gray-500 mt-2">
                    The fading list appears once we have a full {timeframe === '1h' ? '1-hour' : timeframe === '4h' ? '4-hour' : timeframe === '7d' ? '7-day' : '24-hour'} baseline to compare against.
                    {timeframe !== '1h' && (
                      <> <button className="text-purple-600 underline" onClick={() => handleTimeframeChange('1h')}>Switch to 1h</button> to see which stocks are losing momentum right now.</>
                    )}
                  </p>
                </>
              ) : (
                <p className="text-gray-500">
                  No fading stocks found. Waiting for data...
                </p>
              )}
            </div>
          ) : view === 'table' ? (
            <StockTable stocks={stockData.fading.map(s => ({
              ...s,
              price: s.price?.price ?? s.enrichment?.price,
              changePct24h: s.price?.changePct24h ?? s.enrichment?.percent_change_24h,
              staleness: s.price?.staleness,
            }))} type="fading" />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-6">
              {stockData.fading.map((stock, index) => (
                <StockCard
                  key={stock.ticker}
                  rank={index + 1}
                  ticker={stock.ticker}
                  mentionCount={stock.mentionCount}
                  mentionsPrev={stock.mentionsPrev}
                  mentionDelta={stock.mentionDelta}
                  sentimentScore={stock.sentimentScore}
                  sentimentCategory={stock.sentimentCategory}
                  velocity={stock.velocity}
                  timestamp={stock.timestamp}
                  type="fading"
                  sparklineData={stock.sparklineData}
                  rankDelta24h={stock.rankDelta24h}
                  rankStatus={stock.rankStatus}
                  price={stock.price?.price ?? stock.enrichment?.price}
                  changePct24h={stock.price?.changePct24h ?? stock.enrichment?.percent_change_24h}
                  socialDominance={stock.enrichment?.social_dominance}
                  staleness={stock.price?.staleness}
                  coverageSource={stock.coverageSource}
                />
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
