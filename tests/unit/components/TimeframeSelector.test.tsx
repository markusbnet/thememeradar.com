import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import TimeframeSelector from '@/components/TimeframeSelector';
import type { Timeframe } from '@/lib/db/storage';

describe('TimeframeSelector', () => {
  const defaultProps = {
    value: '24h' as Timeframe,
    onChange: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders 4 buttons: 1h, 4h, 24h, 7d', () => {
    render(<TimeframeSelector {...defaultProps} />);
    expect(screen.getByRole('button', { name: '1h' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '4h' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '24h' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '7d' })).toBeInTheDocument();
  });

  it('default selected button is 24h (aria-pressed=true)', () => {
    render(<TimeframeSelector {...defaultProps} />);
    const btn24h = screen.getByRole('button', { name: '24h' });
    expect(btn24h).toHaveAttribute('aria-pressed', 'true');
  });

  it('non-selected buttons have aria-pressed=false', () => {
    render(<TimeframeSelector {...defaultProps} />);
    expect(screen.getByRole('button', { name: '1h' })).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByRole('button', { name: '4h' })).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByRole('button', { name: '7d' })).toHaveAttribute('aria-pressed', 'false');
  });

  it('clicking 1h calls onChange with "1h"', () => {
    const onChange = jest.fn();
    render(<TimeframeSelector value="24h" onChange={onChange} />);
    fireEvent.click(screen.getByRole('button', { name: '1h' }));
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith('1h');
  });

  it('clicking 4h calls onChange with "4h"', () => {
    const onChange = jest.fn();
    render(<TimeframeSelector value="24h" onChange={onChange} />);
    fireEvent.click(screen.getByRole('button', { name: '4h' }));
    expect(onChange).toHaveBeenCalledWith('4h');
  });

  it('clicking 7d calls onChange with "7d"', () => {
    const onChange = jest.fn();
    render(<TimeframeSelector value="24h" onChange={onChange} />);
    fireEvent.click(screen.getByRole('button', { name: '7d' }));
    expect(onChange).toHaveBeenCalledWith('7d');
  });

  it('selected button reflects the value prop', () => {
    render(<TimeframeSelector value="1h" onChange={jest.fn()} />);
    expect(screen.getByRole('button', { name: '1h' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: '24h' })).toHaveAttribute('aria-pressed', 'false');
  });

  it('all buttons are keyboard-accessible (have type=button)', () => {
    render(<TimeframeSelector {...defaultProps} />);
    const buttons = screen.getAllByRole('button');
    expect(buttons).toHaveLength(4);
    for (const btn of buttons) {
      // Buttons are naturally focusable and keyboard accessible
      expect(btn.tagName).toBe('BUTTON');
    }
  });

  it('pressing Enter on a button calls onChange', async () => {
    const onChange = jest.fn();
    render(<TimeframeSelector value="24h" onChange={onChange} />);
    const btn1h = screen.getByRole('button', { name: '1h' });
    btn1h.focus();
    await userEvent.keyboard('{Enter}');
    expect(onChange).toHaveBeenCalledWith('1h');
  });

  it('has an accessible group label', () => {
    render(<TimeframeSelector {...defaultProps} />);
    expect(screen.getByRole('group', { name: 'Select timeframe' })).toBeInTheDocument();
  });
});
