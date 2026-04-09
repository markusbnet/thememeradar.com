'use client';

interface StockChartProps {
  data: { label: string; value: number }[];
  title: string;
  color?: string;
  height?: number;
  valueFormatter?: (value: number) => string;
}

export default function StockChart({
  data,
  title,
  color = '#7c3aed',
  height = 200,
  valueFormatter = (v) => v.toString(),
}: StockChartProps) {
  if (!data || data.length < 2) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">{title}</h2>
        <div style={{ height }} className="flex items-center justify-center text-gray-400">
          Not enough data to display chart
        </div>
      </div>
    );
  }

  const values = data.map(d => d.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;

  const width = 600;
  const paddingLeft = 50;
  const paddingRight = 20;
  const paddingTop = 20;
  const paddingBottom = 40;
  const chartWidth = width - paddingLeft - paddingRight;
  const chartHeight = height - paddingTop - paddingBottom;

  const points = data.map((d, i) => {
    const x = paddingLeft + (i / (data.length - 1)) * chartWidth;
    const y = paddingTop + chartHeight - ((d.value - min) / range) * chartHeight;
    return { x, y, ...d };
  });

  const linePath = `M ${points.map(p => `${p.x},${p.y}`).join(' L ')}`;
  const fillPath = `${linePath} L ${points[points.length - 1].x},${paddingTop + chartHeight} L ${points[0].x},${paddingTop + chartHeight} Z`;

  // Y-axis ticks (5 ticks)
  const yTicks = Array.from({ length: 5 }, (_, i) => {
    const value = min + (range * i) / 4;
    const y = paddingTop + chartHeight - (i / 4) * chartHeight;
    return { value, y };
  });

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h2 className="text-xl font-semibold text-gray-900 mb-4">{title}</h2>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full"
        style={{ maxHeight: height }}
        role="img"
        aria-label={title}
      >
        {/* Grid lines */}
        {yTicks.map((tick, i) => (
          <g key={i}>
            <line
              x1={paddingLeft}
              y1={tick.y}
              x2={width - paddingRight}
              y2={tick.y}
              stroke="#e5e7eb"
              strokeDasharray="4,4"
            />
            <text
              x={paddingLeft - 8}
              y={tick.y + 4}
              textAnchor="end"
              fontSize="14"
              fill="#6b7280"
            >
              {valueFormatter(tick.value)}
            </text>
          </g>
        ))}

        {/* Fill area */}
        <path d={fillPath} fill={color + '1a'} />

        {/* Line */}
        <path d={linePath} fill="none" stroke={color} strokeWidth="2" />

        {/* Data points */}
        {points.map((p, i) => (
          <circle key={i} cx={p.x} cy={p.y} r="3" fill={color} />
        ))}

        {/* X-axis labels */}
        {points.map((p, i) => {
          // Show every other label if more than 7 points
          if (data.length > 7 && i % 2 !== 0 && i !== data.length - 1) return null;
          return (
            <text
              key={i}
              x={p.x}
              y={paddingTop + chartHeight + 20}
              textAnchor="middle"
              fontSize="14"
              fill="#6b7280"
            >
              {p.label}
            </text>
          );
        })}
      </svg>
    </div>
  );
}
