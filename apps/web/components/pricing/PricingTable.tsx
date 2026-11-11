'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Check, Loader2 } from 'lucide-react';
import { PLANS, type Plan } from '@/lib/plans';
import { Alert, Segmented } from '@/components/ui/primitives';
import { SITE } from '@/lib/site';
import { useAuth } from '@/components/auth/AuthProvider';
import { accountApi, ApiError } from '@/lib/api/account-client';

type Interval = 'month' | 'year';

export function PricingTable() {
  const router = useRouter();
  const params = useSearchParams();
  const { user, loading } = useAuth();
  const [cycle, setCycle] = useState<'monthly' | 'yearly'>(params.get('interval') === 'month' ? 'monthly' : 'yearly');
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<{ message: string; contact?: boolean } | null>(null);
  const resumed = useRef(false);

  const startCheckout = useCallback(
    async (plan: 'pro' | 'team', interval: Interval) => {
      setError(null);
      if (!user) {
        // Sign in first, then come back here and resume checkout automatically.
        router.push(`/login?next=${encodeURIComponent(`/pricing?checkout=${plan}&interval=${interval}`)}`);
        return;
      }
      setBusy(plan);
      try {
        const { url } = await accountApi.checkout(plan, interval);
        window.location.href = url; // Stripe Checkout (or the portal if already subscribed)
      } catch (err) {
        const unavailable = err instanceof ApiError && (err.code === 'BILLING_DISABLED' || err.code === 'PRICE_NOT_CONFIGURED');
        setError({ message: (err as Error).message, contact: unavailable });
        setBusy(null);
      }
    },
    [user, router],
  );

  // Resume a checkout that was interrupted by the sign-in step.
  useEffect(() => {
    const plan = params.get('checkout');
    if (resumed.current || loading || !user || (plan !== 'pro' && plan !== 'team')) return;
    resumed.current = true;
    void startCheckout(plan, params.get('interval') === 'month' ? 'month' : 'year');
  }, [params, loading, user, startCheckout]);

  const cta = (p: Plan) => {
    const isCurrent = user?.plan === p.id;
    const base = 'mt-8 inline-flex h-11 items-center justify-center gap-2 rounded-xl text-sm font-semibold transition';
    const primary = 'bg-brand-600 text-white shadow-lg shadow-brand-600/20 hover:bg-brand-700';
    const secondary = 'border border-slate-200 text-slate-900 hover:bg-slate-50 dark:border-white/10 dark:text-white dark:hover:bg-white/5';
    const style = p.highlighted ? primary : secondary;

    if (isCurrent) {
      return <span className={`${base} cursor-default border border-brand-300 text-brand-700 dark:border-brand-500/40 dark:text-brand-300`}><Check className="h-4 w-4" /> Current plan</span>;
    }
    if (p.id === 'free') {
      return <Link href={user ? '/#all-tools' : '/login?next=/account'} className={`${base} ${style}`}>{user ? 'Use free tools' : p.cta}</Link>;
    }
    return (
      <button
        onClick={() => startCheckout(p.id as 'pro' | 'team', cycle === 'yearly' ? 'year' : 'month')}
        disabled={busy !== null}
        className={`${base} ${style} disabled:opacity-70`}
      >
        {busy === p.id && <Loader2 className="h-4 w-4 animate-spin" />}
        {user && user.plan !== 'free' ? 'Switch plan' : p.cta}
      </button>
    );
  };

  return (
    <div>
      {params.get('checkout') === 'cancelled' && <div className="mx-auto mb-6 max-w-xl"><Alert kind="info">Checkout cancelled — you haven’t been charged.</Alert></div>}
      {error && (
        <div className="mx-auto mb-6 max-w-xl">
          <Alert kind="error">
            {error.message}
            {error.contact && <> <a className="font-semibold underline" href={`mailto:${SITE.supportEmail}?subject=EyeShots%20subscription`}>Contact us</a> and we’ll set you up.</>}
          </Alert>
        </div>
      )}
      <div className="mx-auto mb-10 w-full max-w-xs">
        <Segmented value={cycle} onChange={setCycle} options={[{ value: 'monthly', label: 'Monthly' }, { value: 'yearly', label: 'Yearly (save 37%)' }]} />
      </div>
      <div className="grid gap-6 lg:grid-cols-3">
        {PLANS.map((p) => {
          const price = cycle === 'monthly' ? p.monthly : p.yearly;
          return (
            <div
              key={p.id}
              className={`relative flex flex-col rounded-3xl border p-8 ${
                p.highlighted
                  ? 'border-brand-500 bg-white shadow-xl shadow-brand-900/10 ring-1 ring-brand-500 dark:bg-white/[0.04]'
                  : 'border-slate-200 bg-white dark:border-white/[0.08] dark:bg-white/[0.02]'
              }`}
            >
              {p.highlighted && <span className="absolute -top-3 left-8 rounded-full bg-brand-600 px-3 py-1 text-xs font-semibold text-white">Most popular</span>}
              <h3 className="text-lg font-semibold text-slate-900 dark:text-white">{p.name}</h3>
              <p className="mt-1 text-sm text-slate-500">{p.tagline}</p>
              <div className="mt-6 flex items-baseline gap-1">
                <span className="text-4xl font-semibold tracking-tight text-slate-900 dark:text-white">€{price % 1 ? price.toFixed(2) : price}</span>
                <span className="text-sm text-slate-500">/ month</span>
              </div>
              <p className="mt-1 h-5 text-xs text-slate-500">
                {price > 0 && cycle === 'yearly' ? `Billed €${(price * 12).toFixed(0)} yearly` : price > 0 ? 'Billed monthly' : 'No card required'}
              </p>
              <ul className="mt-8 flex-1 space-y-3 text-sm">
                {p.features.map((f) => (
                  <li key={f} className="flex gap-2.5 text-slate-700 dark:text-slate-300">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-brand-600 dark:text-brand-400" /> {f}
                  </li>
                ))}
              </ul>
              {cta(p)}
            </div>
          );
        })}
      </div>
      <p className="mt-8 text-center text-xs text-slate-500">Payments are processed securely by Stripe. Cancel anytime from your account.</p>
    </div>
  );
}
