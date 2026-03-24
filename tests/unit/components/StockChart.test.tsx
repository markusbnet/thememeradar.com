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
});
