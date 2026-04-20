/**
 * Unit tests for OptionsActivitySection component.
 */

import { render, screen } from '@testing-library/react';
import OptionsActivitySection from '@/components/OptionsActivitySection';

interface OptionsActivityData {
  callOpenInterest: number;
  putOpenInterest: number;
  putCallRatio: number;
  iv30d: number | null;
}

const sampleOptions: OptionsActivityData = {
  callOpenInterest: 450000,
  putOpenInterest: 180000,
  putCallRatio: 0.40,
  iv30d: 0.85,
};

describe('OptionsActivitySection', () => {
  it('renders Options Activity heading when options prop is provided', () => {
    render(<OptionsActivitySection options={sampleOptions} />);
    expect(screen.getByText(/Options Activity/i)).toBeInTheDocument();
  });

  it('shows put/call ratio value', () => {
    render(<OptionsActivitySection options={sampleOptions} />);
    expect(screen.getByText('0.40')).toBeInTheDocument();
  });

  it('shows call open interest as K value', () => {
    render(<OptionsActivitySection options={sampleOptions} />);
    // 450000 / 1000 = 450K
    expect(screen.getByText('450K')).toBeInTheDocument();
  });

  it('shows put open interest as K value', () => {
    render(<OptionsActivitySection options={sampleOptions} />);
    // 180000 / 1000 = 180K
    expect(screen.getByText('180K')).toBeInTheDocument();
  });

  it('shows IV percentage when iv30d is not null', () => {
    render(<OptionsActivitySection options={sampleOptions} />);
    // 0.85 * 100 = 85%
    expect(screen.getByText('85%')).toBeInTheDocument();
  });

  it('shows IV: N/A when iv30d is null', () => {
    const nullIvOptions: OptionsActivityData = {
      ...sampleOptions,
      iv30d: null,
    };
    render(<OptionsActivitySection options={nullIvOptions} />);
    expect(screen.getByText('N/A')).toBeInTheDocument();
  });

  it('does not render section when options prop is null', () => {
    const { container } = render(<OptionsActivitySection options={null} />);
    expect(container.firstChild).toBeNull();
  });

  it('does not render section when options prop is undefined', () => {
    const { container } = render(<OptionsActivitySection options={undefined} />);
    expect(container.firstChild).toBeNull();
  });

  it('shows bullish lean for putCallRatio < 1', () => {
    render(<OptionsActivitySection options={{ ...sampleOptions, putCallRatio: 0.40 }} />);
    expect(screen.getByText(/Bullish lean/i)).toBeInTheDocument();
  });

  it('shows bearish lean for putCallRatio > 1', () => {
    render(<OptionsActivitySection options={{ ...sampleOptions, putCallRatio: 1.50 }} />);
    expect(screen.getByText(/Bearish lean/i)).toBeInTheDocument();
  });
});
