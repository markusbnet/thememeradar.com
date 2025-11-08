/**
 * Stock Detail Page
 * Displays comprehensive information about a specific stock ticker
 */

import { notFound } from 'next/navigation';
import StockHeader from '@/components/stock-detail/StockHeader';
import EvidenceSection from '@/components/stock-detail/EvidenceSection';
import StatsTable from '@/components/stock-detail/StatsTable';

interface StockDetailPageProps {
  params: {
    ticker: string;
  };
}

interface StockMetrics {
  ticker: string;
  current: {
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
  };
  historical: {
    timestamp: number;
    mentionCount: number;
    sentimentScore: number;
  }[];
}

interface Evidence {
  ticker: string;
  evidenceId: string;
  type: 'post' | 'comment';
  text: string;
  keywords: string[];
  sentimentScore: number;
  sentimentCategory: string;
  upvotes: number;
  subreddit: string;
  createdAt: number;
  redditUrl?: string;
}

async function getStockDetails(ticker: string): Promise<StockMetrics | null> {
  try {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const response = await fetch(`${baseUrl}/api/stocks/${ticker}`, {
      cache: 'no-store',
    });

    if (!response.ok) {
      return null;
    }

    const data = await response.json();
    return data.success ? data.data : null;
  } catch (error) {
    return null;
  }
}

async function getStockEvidence(ticker: string): Promise<Evidence[]> {
  try {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const response = await fetch(`${baseUrl}/api/stocks/${ticker}/evidence?limit=10`, {
      cache: 'no-store',
    });

    if (!response.ok) {
      return [];
    }

    const data = await response.json();
    return data.success ? data.data.evidence : [];
  } catch (error) {
    return [];
  }
}

export default async function StockDetailPage({ params }: StockDetailPageProps) {
  const ticker = params.ticker.toUpperCase();

  // Fetch stock details and evidence in parallel
  const [stockDetails, evidence] = await Promise.all([
    getStockDetails(ticker),
    getStockEvidence(ticker),
  ]);

  // If no stock data found, show 404
  if (!stockDetails) {
    notFound();
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow">
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
          <StockHeader
            ticker={ticker}
            sentimentScore={stockDetails.current.sentimentScore}
            sentimentCategory={stockDetails.current.sentimentCategory}
            mentionCount={stockDetails.current.mentionCount}
          />
        </div>
      </div>

      {/* Main content */}
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="space-y-8">
          {/* Statistics Table */}
          <StatsTable
            current={stockDetails.current}
            historical={stockDetails.historical}
          />

          {/* Evidence Section */}
          <EvidenceSection evidence={evidence} />

          {/* Charts placeholder - Phase 2 */}
          <div className="rounded-lg bg-white p-6 shadow">
            <h2 className="text-lg font-semibold text-gray-900">Charts</h2>
            <p className="mt-2 text-sm text-gray-500">
              Historical charts coming soon (Phase 2)
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

// Generate metadata for the page
export async function generateMetadata({ params }: StockDetailPageProps) {
  const ticker = params.ticker.toUpperCase();
  return {
    title: `${ticker} - Stock Details | The Meme Radar`,
    description: `View detailed sentiment analysis and mentions for ${ticker} from Reddit communities.`,
  };
}
