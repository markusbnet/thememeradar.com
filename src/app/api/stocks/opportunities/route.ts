import { NextResponse } from 'next/server';
import { getTrendingStocks, getFadingStocks } from '@/lib/db/storage';
import { getEnrichmentMap } from '@/lib/db/enrichment';
import { computeOpportunityScore } from '@/lib/opportunity-score';

export async function GET() {
  try {
    const [trending, fading] = await Promise.all([
      getTrendingStocks(),
      getFadingStocks(),
    ]);

    // Deduplicate — a ticker may appear in both trending and fading
    const seen = new Set<string>();
    const allStocks = [...trending, ...fading].filter((s) => {
      if (seen.has(s.ticker)) return false;
      seen.add(s.ticker);
      return true;
    });

    const tickers = allStocks.map((s) => s.ticker);
    const enrichmentMap = await getEnrichmentMap(tickers);

    const opportunities = allStocks
      .map((stock) => computeOpportunityScore(stock, enrichmentMap.get(stock.ticker) ?? null))
      .filter((opp) => opp.signalLevel !== 'none')
      .sort((a, b) => b.score - a.score);

    return NextResponse.json({
      success: true,
      data: { opportunities },
    });
  } catch (error: unknown) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch opportunities',
      },
      { status: 500 }
    );
  }
}
