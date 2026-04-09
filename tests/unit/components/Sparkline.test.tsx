import { render, screen } from '@testing-library/react';
import Sparkline from '@/components/Sparkline';

describe('Sparkline', () => {
  it('should render an SVG element with data', () => {
    const { container } = render(<Sparkline data={[1, 3, 2, 5, 4]} />);
    const svg = container.querySelector('svg');
    expect(svg).toBeInTheDocument();
  });

  it('should render "No data" when data has fewer than 2 points', () => {
    render(<Sparkline data={[1]} />);
    expect(screen.getByText('No data')).toBeInTheDocument();
  });

  it('should render "No data" when data is empty', () => {
    render(<Sparkline data={[]} />);
    expect(screen.getByText('No data')).toBeInTheDocument();
  });

  it('should have aria-label for accessibility', () => {
    render(<Sparkline data={[1, 2, 3]} />);
    expect(screen.getByRole('img', { name: /sparkline/i })).toBeInTheDocument();
  });

  it('should apply custom width and height via viewBox and be responsive', () => {
    const { container } = render(<Sparkline data={[1, 2, 3]} width={200} height={60} />);
    const svg = container.querySelector('svg');
    expect(svg).toHaveAttribute('viewBox', '0 0 200 60');
    expect(svg).toHaveClass('w-full');
  });

  it('should render a line path and a fill path', () => {
    const { container } = render(<Sparkline data={[1, 5, 3, 7, 2]} />);
    const paths = container.querySelectorAll('path');
    expect(paths.length).toBe(2); // fill + line
  });

  it('should handle flat data (all same values)', () => {
    const { container } = render(<Sparkline data={[5, 5, 5, 5]} />);
    const svg = container.querySelector('svg');
    expect(svg).toBeInTheDocument();
  });
});
