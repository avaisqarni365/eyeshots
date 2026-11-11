import type { Metadata } from 'next';
import { Suspense } from 'react';
import { AccountView } from '@/components/auth/AccountView';

export const metadata: Metadata = {
  title: 'Account',
  robots: { index: false, follow: false },
};

export default function AccountPage() {
  return (
    <Suspense>
      <AccountView />
    </Suspense>
  );
}
