import type { Metadata } from 'next';
import StockDetailClient from './StockDetailClient';

export async function generateMetadata(
  { params }: { params: Promise<{ ticker: string }> }
): Promise<Metadata> {
  const { ticker } = await params;
  return { title: `${ticker.toUpperCase()} - Stock Details` };
}

export default async function StockDetailPage(
  { params }: { params: Promise<{ ticker: string }> }
) {
  const { ticker } = await params;
  return <StockDetailClient ticker={ticker.toUpperCase()} />;
}
