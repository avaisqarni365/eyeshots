import type { Metadata } from 'next';
import { Suspense } from 'react';
import { PricingTable } from '@/components/pricing/PricingTable';
import { FaqList } from '@/components/ui/FaqList';

export const metadata: Metadata = {
  title: 'Pricing',
  description: 'Simple pricing for EyeShots. Free in-browser PDF tools, Pro for unlimited cloud tasks and large files, Business for teams.',
  alternates: { canonical: '/pricing' },
};

const FAQ = [
  { q: 'Can I cancel at any time?', a: 'Yes. Subscriptions can be cancelled at any time and remain active until the end of the paid period.' },
  { q: 'What counts as a cloud task?', a: 'Any task processed on our servers: OCR, Office conversions, PDF to Word, compression, password protection and unlocking. Browser-based tools are always unlimited.' },
  { q: 'Do you offer refunds?', a: 'If you are not satisfied, contact us within 14 days of purchase for a full refund.' },
  { q: 'Is VAT included?', a: 'Prices are shown excluding VAT. Applicable VAT is calculated at checkout based on your location.' },
];

export default function PricingPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:px-8">
      <div className="mx-auto mb-12 max-w-2xl text-center">
        <h1 className="text-4xl font-semibold tracking-tight text-slate-900 sm:text-5xl dark:text-white">Simple, honest pricing</h1>
        <p className="mt-4 text-lg text-slate-600 dark:text-slate-400">Browser tools are free forever. Pay only when you need the heavy lifting.</p>
      </div>
      <Suspense>
        <PricingTable />
      </Suspense>
      <div className="mx-auto mt-24 max-w-3xl">
        <h2 className="mb-8 text-center text-2xl font-semibold tracking-tight text-slate-900 dark:text-white">Billing questions</h2>
        <FaqList items={FAQ} />
      </div>
    </div>
  );
}
