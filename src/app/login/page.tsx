import type { Metadata } from 'next';
import LoginClient from './LoginClient';

export const metadata: Metadata = {
  title: 'Log In - The Meme Radar',
};

export default function LoginPage() {
  return <LoginClient />;
}
