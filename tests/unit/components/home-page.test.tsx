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
});
