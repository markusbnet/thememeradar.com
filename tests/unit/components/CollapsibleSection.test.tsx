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

  it('should have responsive padding on button (p-4 sm:p-6)', () => {
    render(
      <CollapsibleSection title="Padding Test">
        <p>Content</p>
      </CollapsibleSection>
    );
    const button = screen.getByRole('button');
    expect(button.className).toContain('p-4');
    expect(button.className).toContain('sm:p-6');
  });

  it('should have responsive padding on content area', () => {
    const { container } = render(
      <CollapsibleSection title="Content Padding" defaultOpen={true}>
        <p>Inner content</p>
      </CollapsibleSection>
    );
    // Content div is a sibling of the button inside the shadow container
    const button = container.querySelector('button');
    const contentDiv = button!.nextElementSibling as HTMLElement;
    expect(contentDiv).not.toBeNull();
    expect(contentDiv.className).toContain('px-4');
    expect(contentDiv.className).toContain('sm:px-6');
  });
});
