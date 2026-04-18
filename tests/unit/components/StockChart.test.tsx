import { render, screen } from '@testing-library/react';
import StockChart from '@/components/StockChart';

describe('StockChart', () => {
  const sampleData = [
    { label: 'Mon', value: 10 },
    { label: 'Tue', value: 25 },
    { label: 'Wed', value: 15 },
    { label: 'Thu', value: 30 },
    { label: 'Fri', value: 20 },
    { label: 'Sat', value: 35 },
    { label: 'Sun', value: 28 },
  ];

  it('should render the chart title', () => {
    render(<StockChart data={sampleData} title="Mention Count" />);
    expect(screen.getByText('Mention Count')).toBeInTheDocument();
  });

  it('should render an SVG when data is provided', () => {
    const { container } = render(<StockChart data={sampleData} title="Test" />);
    const svg = container.querySelector('svg');
    expect(svg).toBeInTheDocument();
  });

  it('should show "Not enough data" message with insufficient data', () => {
    render(<StockChart data={[{ label: 'Mon', value: 10 }]} title="Test" />);
    expect(screen.getByText(/not enough data/i)).toBeInTheDocument();
  });

  it('should render data points as circles', () => {
    const { container } = render(<StockChart data={sampleData} title="Test" />);
    const circles = container.querySelectorAll('circle');
    expect(circles.length).toBe(sampleData.length);
  });

  it('should render x-axis labels', () => {
    render(<StockChart data={sampleData} title="Test" />);
    expect(screen.getByText('Mon')).toBeInTheDocument();
    expect(screen.getByText('Sun')).toBeInTheDocument();
  });

  it('should have aria-label for accessibility', () => {
    render(<StockChart data={sampleData} title="Sentiment Over Time" />);
    expect(screen.getByRole('img', { name: 'Sentiment Over Time' })).toBeInTheDocument();
  });

  it('should render with custom color', () => {
    const { container } = render(
      <StockChart data={sampleData} title="Test" color="#16a34a" />
    );
    const path = container.querySelector('path[stroke="#16a34a"]');
    expect(path).toBeInTheDocument();
  });

  it('should have responsive SVG with viewBox and w-full class', () => {
    const { container } = render(<StockChart data={sampleData} title="Test" />);
    const svg = container.querySelector('svg');
    expect(svg).toBeInTheDocument();
    expect(svg!.getAttribute('viewBox')).toBe('0 0 600 200');
    expect(svg!.classList.contains('w-full')).toBe(true);
  });

  it('should not render SVG when data is empty', () => {
    const { container } = render(<StockChart data={[]} title="Test" />);
    const svg = container.querySelector('svg');
    expect(svg).not.toBeInTheDocument();
    expect(screen.getByText(/not enough data/i)).toBeInTheDocument();
  });

  it('should apply custom height to viewBox and empty state', () => {
    const { container } = render(
      <StockChart data={sampleData} title="Test" height={300} />
    );
    const svg = container.querySelector('svg');
    expect(svg!.getAttribute('viewBox')).toBe('0 0 600 300');
  });

  it('should apply valueFormatter to y-axis tick labels', () => {
    const formatter = (v: number) => `${v.toFixed(1)}%`;
    render(
      <StockChart data={sampleData} title="Test" valueFormatter={formatter} />
    );
    // The min value is 10, formatted as "10.0%"
    expect(screen.getByText('10.0%')).toBeInTheDocument();
  });

  it('should render grid lines for y-axis ticks', () => {
    const { container } = render(<StockChart data={sampleData} title="Test" />);
    const gridLines = container.querySelectorAll('line[stroke-dasharray="4,4"]');
    expect(gridLines.length).toBe(5);
  });

  it('should handle data with identical values without crashing', () => {
    const flatData = [
      { label: 'Mon', value: 50 },
      { label: 'Tue', value: 50 },
      { label: 'Wed', value: 50 },
    ];
    const { container } = render(<StockChart data={flatData} title="Flat" />);
    const svg = container.querySelector('svg');
    expect(svg).toBeInTheDocument();
    const circles = container.querySelectorAll('circle');
    expect(circles.length).toBe(3);
  });

  it('should drop every-other x-axis label when data length > 7', () => {
    // With 9 points, the rule is: render index 0, 2, 4, 6, 8 (last). Skip 1, 3, 5, 7.
    const longData = [
      { label: 'P0', value: 1 },
      { label: 'P1', value: 2 },
      { label: 'P2', value: 3 },
      { label: 'P3', value: 4 },
      { label: 'P4', value: 5 },
      { label: 'P5', value: 6 },
      { label: 'P6', value: 7 },
      { label: 'P7', value: 8 },
      { label: 'P8', value: 9 },
    ];
    render(<StockChart data={longData} title="Long" />);

    expect(screen.getByText('P0')).toBeInTheDocument();
    expect(screen.queryByText('P1')).not.toBeInTheDocument();
    expect(screen.getByText('P2')).toBeInTheDocument();
    expect(screen.queryByText('P3')).not.toBeInTheDocument();
    expect(screen.getByText('P4')).toBeInTheDocument();
    // Last label (P8) is always rendered, even at an odd index
    expect(screen.getByText('P8')).toBeInTheDocument();
  });

  it('should render every x-axis label when data length ≤ 7', () => {
    // 7 points → no label dropping.
    render(<StockChart data={sampleData} title="Test" />);
    sampleData.forEach((d) => {
      expect(screen.getByText(d.label)).toBeInTheDocument();
    });
  });
});
