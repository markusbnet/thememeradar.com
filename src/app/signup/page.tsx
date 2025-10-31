'use client';

import { useState, FormEvent, useEffect, ChangeEvent } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function SignupPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [emailError, setEmailError] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [touched, setTouched] = useState({ email: false, password: false });

  // Set page title
  useEffect(() => {
    document.title = 'Sign Up - The Meme Radar';
  }, []);

  // Email validation
  const validateEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email.trim());
  };

  // Password validation
  const validatePassword = (password: string): boolean => {
    return (
      password.length >= 8 &&
      /[A-Z]/.test(password) &&
      /[a-z]/.test(password) &&
      /[0-9]/.test(password) &&
      /[^A-Za-z0-9]/.test(password)
    );
  };

  // Handle email change with validation
  const handleEmailChange = (e: ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setEmail(value);

    // Clear general error when user starts typing
    if (error) setError('');

    // Validate email in real-time if field has been touched
    if (touched.email) {
      if (!value.trim()) {
        setEmailError('Email is required');
      } else if (!validateEmail(value)) {
        setEmailError('Invalid email address');
      } else {
        setEmailError('');
      }
    }
  };

  // Handle password change with validation
  const handlePasswordChange = (e: ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setPassword(value);

    // Clear general error when user starts typing
    if (error) setError('');

    // Validate password in real-time if field has been touched
    if (touched.password) {
      if (!value) {
        setPasswordError('Password is required');
      } else if (!validatePassword(value)) {
        setPasswordError('Password must be at least 8 characters with uppercase, lowercase, number, and special character');
      } else {
        setPasswordError('');
      }
    }
  };

  // Handle blur to mark field as touched
  const handleEmailBlur = () => {
    setTouched(prev => ({ ...prev, email: true }));
    if (!email.trim()) {
      setEmailError('Email is required');
    } else if (!validateEmail(email)) {
      setEmailError('Invalid email address');
    }
  };

  const handlePasswordBlur = () => {
    setTouched(prev => ({ ...prev, password: true }));
    if (!password) {
      setPasswordError('Password is required');
    } else if (!validatePassword(password)) {
      setPasswordError('Password must be at least 8 characters with uppercase, lowercase, number, and special character');
    }
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError('');

    // Mark all fields as touched to show validation errors
    setTouched({ email: true, password: true });

    // Validate all fields
    const emailValid = validateEmail(email);
    const passwordValid = validatePassword(password);

    if (!email.trim()) {
      setEmailError('Email is required');
    } else if (!emailValid) {
      setEmailError('Invalid email address');
    } else {
      setEmailError('');
    }

    if (!password) {
      setPasswordError('Password is required');
    } else if (!passwordValid) {
      setPasswordError('Password must be at least 8 characters with uppercase, lowercase, number, and special character');
    } else {
      setPasswordError('');
    }

    // Don't submit if validation fails
    if (!emailValid || !passwordValid) {
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email: email.trim(), password }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || 'Signup failed');
        setIsLoading(false);
        return;
      }

      // Signup successful, redirect to dashboard
      router.push('/dashboard');
    } catch (err) {
      setError('An unexpected error occurred. Please try again.');
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 px-4 py-12">
      <div className="w-full max-w-md">
        {/* Logo/Title */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-white mb-2">
            The Meme Radar
          </h1>
          <p className="text-slate-300">
            Track meme stock trends from Reddit
          </p>
        </div>

        {/* Signup Card */}
        <div className="bg-white rounded-lg shadow-xl p-8">
          <h2 className="text-2xl font-bold text-slate-900 mb-6">
            Sign Up
          </h2>

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Email Field */}
            <div>
              <label
                htmlFor="email"
                className="block text-sm font-medium text-slate-700 mb-2"
              >
                Email
              </label>
              <input
                id="email"
                type="text"
                value={email}
                onChange={handleEmailChange}
                onBlur={handleEmailBlur}
                className={`w-full px-4 py-2 border ${
                  emailError ? 'border-red-300' : 'border-slate-300'
                } rounded-lg focus:ring-2 ${
                  emailError ? 'focus:ring-red-500' : 'focus:ring-purple-500'
                } focus:border-transparent outline-none transition text-slate-900`}
                placeholder="you@example.com"
                autoComplete="email"
                aria-invalid={!!emailError}
                aria-describedby={emailError ? 'email-error' : undefined}
              />
              {emailError && (
                <p id="email-error" className="mt-1 text-sm text-red-600">
                  {emailError}
                </p>
              )}
            </div>

            {/* Password Field */}
            <div>
              <label
                htmlFor="password"
                className="block text-sm font-medium text-slate-700 mb-2"
              >
                Password
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={handlePasswordChange}
                  onBlur={handlePasswordBlur}
                  className={`w-full px-4 py-2 border ${
                    passwordError ? 'border-red-300' : 'border-slate-300'
                  } rounded-lg focus:ring-2 ${
                    passwordError ? 'focus:ring-red-500' : 'focus:ring-purple-500'
                  } focus:border-transparent outline-none transition text-slate-900`}
                  placeholder="••••••••"
                  autoComplete="new-password"
                  aria-invalid={!!passwordError}
                  aria-describedby={passwordError ? 'password-error' : 'password-hint'}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-700 transition"
                  aria-label="Toggle visibility"
                >
                  {showPassword ? (
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                      strokeWidth={1.5}
                      stroke="currentColor"
                      className="w-5 h-5"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88"
                      />
                    </svg>
                  ) : (
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                      strokeWidth={1.5}
                      stroke="currentColor"
                      className="w-5 h-5"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z"
                      />
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                      />
                    </svg>
                  )}
                </button>
              </div>
              {passwordError ? (
                <p id="password-error" className="mt-1 text-sm text-red-600">
                  {passwordError}
                </p>
              ) : (
                <p id="password-hint" className="mt-2 text-xs text-slate-500">
                  Must be at least 8 characters with uppercase, lowercase, number, and special character
                </p>
              )}
            </div>

            {/* Error Message */}
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
                {error}
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-purple-600 hover:bg-purple-700 disabled:bg-purple-400 text-white font-semibold py-2 px-4 rounded-lg transition duration-200 ease-in-out transform hover:scale-105 disabled:transform-none disabled:cursor-not-allowed"
            >
              {isLoading ? 'Signing up...' : 'Sign Up'}
            </button>
          </form>

          {/* Login Link */}
          <p className="mt-6 text-center text-sm text-slate-600">
            Already have an account?{' '}
            <Link
              href="/login"
              className="text-purple-600 hover:text-purple-700 font-semibold"
            >
              Log in
            </Link>
          </p>
        </div>

        {/* Footer */}
        <p className="mt-8 text-center text-sm text-slate-400">
          By signing up, you agree to track meme stocks to the moon
        </p>
      </div>
    </div>
  );
}
