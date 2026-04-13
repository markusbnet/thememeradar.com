import { render, screen, fireEvent } from '@testing-library/react';
import CollapsibleSection from '@/components/CollapsibleSection';

describe('CollapsibleSection', () => {
  it('should render the title', () => {
    render(
      <CollapsibleSection title="Test Section">
        <p>Content</p>
      </CollapsibleSection>
    );
    expect(screen.getByText('Test Section')).toBeInTheDocument();
  });

  it('should show content when defaultOpen is true', () => {
    render(
      <CollapsibleSection title="Test" defaultOpen={true}>
        <p>Visible content</p>
      </CollapsibleSection>
    );
    expect(screen.getByText('Visible content')).toBeInTheDocument();
  });

  it('should hide content when defaultOpen is false', () => {
    render(
      <CollapsibleSection title="Test" defaultOpen={false}>
        <p>Hidden content</p>
      </CollapsibleSection>
    );
    expect(screen.queryByText('Hidden content')).not.toBeInTheDocument();
  });

  it('should toggle content on click', () => {
    render(
      <CollapsibleSection title="Toggle Test" defaultOpen={true}>
        <p>Toggleable</p>
      </CollapsibleSection>
    );

    expect(screen.getByText('Toggleable')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button'));
    expect(screen.queryByText('Toggleable')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button'));
    expect(screen.getByText('Toggleable')).toBeInTheDocument();
  });

  it('should have min-height of 44px for touch target', () => {
    render(
      <CollapsibleSection title="Touch Test">
        <p>Content</p>
      </CollapsibleSection>
    );
    const button = screen.getByRole('button');
    expect(button.className).toContain('min-h-[44px]');
  });

  it('should have aria-label describing the section', () => {
    render(
      <CollapsibleSection title="Evidence" defaultOpen={true}>
        <p>Content</p>
      </CollapsibleSection>
    );
    const button = screen.getByRole('button');
    expect(button).toHaveAttribute('aria-label', 'Collapse Evidence');

    fireEvent.click(button);
    expect(button).toHaveAttribute('aria-label', 'Expand Evidence');
  });

  it('should have aria-expanded attribute', () => {
    render(
      <CollapsibleSection title="Aria Test" defaultOpen={true}>
        <p>Content</p>
      </CollapsibleSection>
    );
    const button = screen.getByRole('button');
    expect(button).toHaveAttribute('aria-expanded', 'true');

    fireEvent.click(button);
    expect(button).toHaveAttribute('aria-expanded', 'false');
  });
});
