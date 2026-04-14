'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { checkAuth, logout, type User } from '@/lib/auth/client';
import StockCard from '@/components/StockCard';
import RefreshTimer from '@/components/RefreshTimer';
import SurgeAlert from '@/components/SurgeAlert';
import type { SurgeStock } from '@/lib/db/surge';

interface TrendingStock {
  ticker: string;
  mentionCount: number;
  sentimentScore: number;
  sentimentCategory: string;
  velocity: number;
  timestamp: number;
  sparklineData?: number[];
}

interface StockData {
  trending: TrendingStock[];
  fading: TrendingStock[];
  timestamp: number;
}

export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [stockData, setStockData] = useState<StockData | null>(null);
  const [surgeData, setSurgeData] = useState<SurgeStock[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    document.title = 'Dashboard - The Meme Radar';

    // Check authentication on mount
    const verifyAuth = async () => {
      const { authenticated, user: userData } = await checkAuth();

      if (!authenticated) {
        // Redirect to login if not authenticated
        router.push('/login');
        return;
      }

      setUser(userData || null);
      setIsLoading(false);

      // Fetch stock data and surge data in parallel
      await Promise.all([fetchStockData(), fetchSurgeData()]);
    };

    verifyAuth();
  }, [router]);

  const fetchStockData = async () => {
    try {
      const response = await fetch('/api/stocks/trending');
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
              <RefreshTimer />
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
        <SurgeAlert stocks={surgeData} />

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
              <p className="text-sm text-gray-400 mt-2">
                The background scanner runs every 5 minutes
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-6">
              {stockData.trending.map((stock, index) => (
                <StockCard
                  key={stock.ticker}
                  rank={index + 1}
                  ticker={stock.ticker}
                  mentionCount={stock.mentionCount}
                  sentimentScore={stock.sentimentScore}
                  sentimentCategory={stock.sentimentCategory}
                  velocity={stock.velocity}
                  timestamp={stock.timestamp}
                  type="trending"
                  sparklineData={stock.sparklineData}
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
              <p className="text-gray-500">
                No fading stocks found. Waiting for data...
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-6">
              {stockData.fading.map((stock, index) => (
                <StockCard
                  key={stock.ticker}
                  rank={index + 1}
                  ticker={stock.ticker}
                  mentionCount={stock.mentionCount}
                  sentimentScore={stock.sentimentScore}
                  sentimentCategory={stock.sentimentCategory}
                  velocity={stock.velocity}
                  timestamp={stock.timestamp}
                  type="fading"
                  sparklineData={stock.sparklineData}
                />
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
