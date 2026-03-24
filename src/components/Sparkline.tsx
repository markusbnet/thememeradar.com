'use client';

interface SparklineProps {
  data: number[];
  width?: number;
  height?: number;
  color?: string;
  fillColor?: string;
}

export default function Sparkline({
  data,
  width = 120,
  height = 40,
  color = '#7c3aed',
  fillColor = 'rgba(124, 58, 237, 0.1)',
}: SparklineProps) {
  if (!data || data.length < 2) {
    return (
      <div style={{ width, height }} className="flex items-center justify-center text-gray-300 text-xs">
        No data
      </div>
    );
  }

  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;

  const padding = 2;
  const chartWidth = width - padding * 2;
  const chartHeight = height - padding * 2;

  const points = data.map((value, i) => {
    const x = padding + (i / (data.length - 1)) * chartWidth;
    const y = padding + chartHeight - ((value - min) / range) * chartHeight;
    return `${x},${y}`;
  });

  const linePath = `M ${points.join(' L ')}`;
  const fillPath = `${linePath} L ${padding + chartWidth},${padding + chartHeight} L ${padding},${padding + chartHeight} Z`;

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label="Sparkline chart"
    >
      <path d={fillPath} fill={fillColor} />
      <path d={linePath} fill="none" stroke={color} strokeWidth="1.5" />
    </svg>
  );
}
