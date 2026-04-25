import { render, screen, fireEvent } from '@testing-library/react';
import ViewToggle from '@/components/ViewToggle';

describe('ViewToggle', () => {
  it('renders Cards and Table buttons', () => {
    render(<ViewToggle view="cards" onChange={jest.fn()} />);
    expect(screen.getByRole('button', { name: /Cards/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Table/i })).toBeInTheDocument();
  });

  it('Cards button has aria-pressed=true when view is cards', () => {
    render(<ViewToggle view="cards" onChange={jest.fn()} />);
    expect(screen.getByRole('button', { name: /Cards/i })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: /Table/i })).toHaveAttribute('aria-pressed', 'false');
  });

  it('Table button has aria-pressed=true when view is table', () => {
    render(<ViewToggle view="table" onChange={jest.fn()} />);
    expect(screen.getByRole('button', { name: /Table/i })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: /Cards/i })).toHaveAttribute('aria-pressed', 'false');
  });

  it('calls onChange with table when Table button is clicked', () => {
    const onChange = jest.fn();
    render(<ViewToggle view="cards" onChange={onChange} />);
    fireEvent.click(screen.getByRole('button', { name: /Table/i }));
    expect(onChange).toHaveBeenCalledWith('table');
  });

  it('calls onChange with cards when Cards button is clicked', () => {
    const onChange = jest.fn();
    render(<ViewToggle view="table" onChange={onChange} />);
    fireEvent.click(screen.getByRole('button', { name: /Cards/i }));
    expect(onChange).toHaveBeenCalledWith('cards');
  });

  it('both buttons are tabbable (no negative tabIndex)', () => {
    render(<ViewToggle view="cards" onChange={jest.fn()} />);
    screen.getAllByRole('button').forEach(btn =>
      expect(btn).not.toHaveAttribute('tabIndex', '-1'),
    );
  });

  it('has a group role with accessible label', () => {
    render(<ViewToggle view="cards" onChange={jest.fn()} />);
    expect(screen.getByRole('group', { name: /View mode/i })).toBeInTheDocument();
  });
});
