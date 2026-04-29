import type { Metadata } from 'next';
import SignupClient from './SignupClient';

export const metadata: Metadata = {
  title: 'Sign Up - The Meme Radar',
};

export default function SignupPage() {
  return <SignupClient />;
}
