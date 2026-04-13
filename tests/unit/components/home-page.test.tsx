import { render, screen } from '@testing-library/react';
import Home from '@/app/page';

describe('Home Page', () => {
  it('renders the app title', () => {
    render(<Home />);
    expect(screen.getByRole('heading', { level: 1 })).toBeDefined();
    expect(screen.getByText(/the meme radar/i)).toBeDefined();
  });

  it('renders the tagline', () => {
    render(<Home />);
    expect(screen.getByText(/track meme stock trends/i)).toBeDefined();
  });

  it('renders Log In link', () => {
    render(<Home />);
    const loginLink = screen.getByRole('link', { name: /log in/i });
    expect(loginLink.getAttribute('href')).toBe('/login');
  });

  it('renders Sign Up link', () => {
    render(<Home />);
    const signupLink = screen.getByRole('link', { name: /sign up/i });
    expect(signupLink.getAttribute('href')).toBe('/signup');
  });

  it('renders exactly two navigation links', () => {
    render(<Home />);
    const links = screen.getAllByRole('link');
    expect(links).toHaveLength(2);
  });

  it('has a main landmark for accessibility', () => {
    render(<Home />);
    const main = screen.getByRole('main');
    expect(main).toBeDefined();
  });

  it('includes the radar emoji in the heading', () => {
    render(<Home />);
    const heading = screen.getByRole('heading', { level: 1 });
    expect(heading.textContent).toContain('\u{1F4E1}');
  });

  it('applies min-h-[44px] to Log In link for tap target compliance', () => {
    render(<Home />);
    const loginLink = screen.getByRole('link', { name: /log in/i });
    expect(loginLink.className).toContain('min-h-[44px]');
  });

  it('applies min-h-[44px] to Sign Up link for tap target compliance', () => {
    render(<Home />);
    const signupLink = screen.getByRole('link', { name: /sign up/i });
    expect(signupLink.className).toContain('min-h-[44px]');
  });

  it('uses responsive text sizing on the heading', () => {
    render(<Home />);
    const heading = screen.getByRole('heading', { level: 1 });
    expect(heading.className).toContain('text-3xl');
    expect(heading.className).toContain('sm:text-5xl');
  });

  it('switches button container from column to row on sm breakpoint', () => {
    render(<Home />);
    const loginLink = screen.getByRole('link', { name: /log in/i });
    const buttonContainer = loginLink.parentElement;
    expect(buttonContainer?.className).toContain('flex-col');
    expect(buttonContainer?.className).toContain('sm:flex-row');
  });

  it('uses full viewport height for the page layout', () => {
    render(<Home />);
    const heading = screen.getByRole('heading', { level: 1 });
    // The outermost div wrapping everything
    const pageWrapper = heading.closest('.min-h-screen');
    expect(pageWrapper).not.toBeNull();
  });

  it('renders the full tagline text', () => {
    render(<Home />);
    expect(
      screen.getByText('Track meme stock trends from Reddit in real-time')
    ).toBeDefined();
  });
});
