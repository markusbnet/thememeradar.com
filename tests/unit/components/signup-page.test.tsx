import { render, screen, waitFor, act, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import SignupPage from '@/app/signup/page';

// Mock next/navigation
const mockPush = jest.fn();
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
  }),
}));

describe('SignupPage', () => {
  beforeEach(() => {
    mockPush.mockClear();
    global.fetch = jest.fn() as jest.Mock;
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('renders the form with email and password fields', () => {
    render(<SignupPage />);

    expect(screen.getByLabelText('Email')).toBeInTheDocument();
    expect(screen.getByLabelText('Password')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /sign up/i })).toBeInTheDocument();
  });

  it('shows "Sign Up" heading', () => {
    render(<SignupPage />);

    expect(screen.getByRole('heading', { name: /sign up/i })).toBeInTheDocument();
  });

  it('shows link to login page', () => {
    render(<SignupPage />);

    const loginLink = screen.getByRole('link', { name: /log in/i });
    expect(loginLink).toBeInTheDocument();
    expect(loginLink.getAttribute('href')).toBe('/login');
  });

  it('shows password hint text initially', () => {
    render(<SignupPage />);

    expect(
      screen.getByText(
        'Must be at least 8 characters with uppercase, lowercase, number, and special character'
      )
    ).toBeInTheDocument();
  });

  it('shows "Email is required" when email is blurred while empty', async () => {
    render(<SignupPage />);

    const emailInput = screen.getByLabelText('Email');
    fireEvent.blur(emailInput);

    expect(screen.getByText('Email is required')).toBeInTheDocument();
  });

  it('shows "Invalid email address" when email is invalid on blur', async () => {
    const user = userEvent.setup();
    render(<SignupPage />);

    const emailInput = screen.getByLabelText('Email');
    await user.type(emailInput, 'notanemail');
    fireEvent.blur(emailInput);

    expect(screen.getByText('Invalid email address')).toBeInTheDocument();
  });

  it('shows "Password is required" when password is blurred while empty', async () => {
    render(<SignupPage />);

    const passwordInput = screen.getByLabelText('Password');
    fireEvent.blur(passwordInput);

    expect(screen.getByText('Password is required')).toBeInTheDocument();
  });

  it('shows password validation error when password is weak on blur', async () => {
    const user = userEvent.setup();
    render(<SignupPage />);

    const passwordInput = screen.getByLabelText('Password');
    await user.type(passwordInput, 'weak');
    fireEvent.blur(passwordInput);

    expect(
      screen.getByText(
        'Password must be at least 8 characters with uppercase, lowercase, number, and special character'
      )
    ).toBeInTheDocument();
  });

  it('shows "Signing up..." while submitting', async () => {
    const user = userEvent.setup();
    // Make fetch hang so loading state persists
    (global.fetch as jest.Mock).mockReturnValue(new Promise(() => {}));

    render(<SignupPage />);

    const emailInput = screen.getByLabelText('Email');
    const passwordInput = screen.getByLabelText('Password');

    await user.type(emailInput, 'test@example.com');
    await user.type(passwordInput, 'TestUser123!');
    await user.click(screen.getByRole('button', { name: /sign up/i }));

    expect(screen.getByRole('button', { name: /signing up\.\.\./i })).toBeInTheDocument();
  });

  it('redirects to /dashboard on successful signup', async () => {
    const user = userEvent.setup();
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ success: true }),
    });

    render(<SignupPage />);

    const emailInput = screen.getByLabelText('Email');
    const passwordInput = screen.getByLabelText('Password');

    await user.type(emailInput, 'test@example.com');
    await user.type(passwordInput, 'TestUser123!');
    await user.click(screen.getByRole('button', { name: /sign up/i }));

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/dashboard');
    });
  });

  it('shows error message on failed signup', async () => {
    const user = userEvent.setup();
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: false,
      json: () => Promise.resolve({ error: 'Email already in use' }),
    });

    render(<SignupPage />);

    const emailInput = screen.getByLabelText('Email');
    const passwordInput = screen.getByLabelText('Password');

    await user.type(emailInput, 'test@example.com');
    await user.type(passwordInput, 'TestUser123!');
    await user.click(screen.getByRole('button', { name: /sign up/i }));

    await waitFor(() => {
      expect(screen.getByText('Email already in use')).toBeInTheDocument();
    });
  });

  it('shows generic error on network failure', async () => {
    const user = userEvent.setup();
    (global.fetch as jest.Mock).mockRejectedValue(new Error('Network error'));

    render(<SignupPage />);

    const emailInput = screen.getByLabelText('Email');
    const passwordInput = screen.getByLabelText('Password');

    await user.type(emailInput, 'test@example.com');
    await user.type(passwordInput, 'TestUser123!');
    await user.click(screen.getByRole('button', { name: /sign up/i }));

    await waitFor(() => {
      expect(
        screen.getByText('An unexpected error occurred. Please try again.')
      ).toBeInTheDocument();
    });
  });

  it('password toggle button switches between show and hide', async () => {
    const user = userEvent.setup();
    render(<SignupPage />);

    const passwordInput = screen.getByLabelText('Password');
    expect(passwordInput).toHaveAttribute('type', 'password');

    // Click "Show password" toggle
    const toggleButton = screen.getByRole('button', { name: /show password/i });
    await user.click(toggleButton);

    expect(passwordInput).toHaveAttribute('type', 'text');

    // Click "Hide password" toggle
    const hideButton = screen.getByRole('button', { name: /hide password/i });
    await user.click(hideButton);

    expect(passwordInput).toHaveAttribute('type', 'password');
  });

  it('password error replaces hint text', async () => {
    const user = userEvent.setup();
    render(<SignupPage />);

    // Hint text is visible initially
    expect(screen.getByText(/Must be at least 8 characters/)).toBeInTheDocument();

    const passwordInput = screen.getByLabelText('Password');
    await user.type(passwordInput, 'weak');
    fireEvent.blur(passwordInput);

    // Error text is shown
    expect(
      screen.getByText(
        'Password must be at least 8 characters with uppercase, lowercase, number, and special character'
      )
    ).toBeInTheDocument();

    // Hint text (the one with id="password-hint") should no longer be in the document
    expect(screen.queryByText(/^Must be at least 8 characters/)).not.toBeInTheDocument();
  });
});
