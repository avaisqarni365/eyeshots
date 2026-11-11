import type { Metadata } from 'next';
import { Suspense } from 'react';
import { LoginForm } from '@/components/auth/LoginForm';

export const metadata: Metadata = {
  title: 'Sign in',
  robots: { index: false, follow: false },
};

export default function LoginPage() {
  return (
    <div className="px-4 py-16 sm:py-24">
      <Suspense>
        <LoginForm />
      </Suspense>
    </div>
  );
}
