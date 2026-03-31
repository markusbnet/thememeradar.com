import { logger } from '@/lib/logger';
import { NextResponse } from 'next/server';
import { getStockEvidence } from '@/lib/db/storage';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ ticker: string }> }
) {
  try {
    const { ticker: tickerParam } = await params;
    const ticker = tickerParam.toUpperCase();

    const url = new URL(request.url);
    const limitParam = url.searchParams.get('limit');
    const limit = limitParam ? Math.min(parseInt(limitParam, 10) || 10, 50) : 10;

    const evidence = await getStockEvidence(ticker, limit);

    return NextResponse.json({
      success: true,
      data: {
        ticker,
        evidence,
        count: evidence.length,
        limit,
      },
    });
  } catch (error: unknown) {
    logger.error('Stock evidence API error:', error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch evidence',
      },
      { status: 500 }
    );
  }
}
