'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { CreditCard, Download, LogOut, Sparkles, Trash2, AlertTriangle, CheckCircle2, Loader2 } from 'lucide-react';
import { accountApi, ApiError, PLAN_LABEL, type AccountDetails } from '@/lib/api/account-client';
import { useAuth } from './AuthProvider';
import { Alert, Button, Panel, Progress, inputCls } from '@/components/ui/primitives';

const fmtDate = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' }) : '—');

export function AccountView() {
  const router = useRouter();
  const params = useSearchParams();
  const { user, loading, refresh, signOut, signedOut } = useAuth();
  // Read via ref so signing out doesn't re-run effects or trigger a redirect to /login.
  const signedOutRef = useRef(signedOut);
  signedOutRef.current = signedOut;
  const [details, setDetails] = useState<AccountDetails | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [confirmText, setConfirmText] = useState('');
  const [awaitingUpgrade, setAwaitingUpgrade] = useState(params.get('checkout') === 'success');

  const load = useCallback(async () => {
    try {
      setDetails(await accountApi.details());
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        if (!signedOutRef.current) router.replace('/login?next=/account');
      }
      else setError((err as Error).message);
    }
  }, [router]);

  useEffect(() => {
    if (loading) return;
    if (!user) {
      if (!signedOutRef.current) router.replace('/login?next=/account');
    } else void load();
  }, [loading, user, load, router]);

  // After Checkout, the plan changes when Stripe's webhook arrives (usually within seconds).
  useEffect(() => {
    if (!awaitingUpgrade) return;
    let tries = 0;
    const t = setInterval(async () => {
      tries++;
      const u = await refresh();
      if ((u && u.plan !== 'free') || tries >= 15) {
        clearInterval(t);
        setAwaitingUpgrade(false);
        void load();
        router.replace('/account');
      }
    }, 2000);
    return () => clearInterval(t);
  }, [awaitingUpgrade, refresh, load, router]);

  const go = async (key: string, fn: () => Promise<{ url: string }>) => {
    setBusy(key); setError(null);
    try {
      window.location.href = (await fn()).url;
    } catch (err) {
      setError((err as Error).message);
      setBusy(null);
    }
  };

  const deleteAccount = async () => {
    setBusy('delete'); setError(null);
    try {
      await accountApi.deleteAccount();
      await signOut(); // marks the tab as signed out so this page doesn't bounce to /login
      router.replace('/');
    } catch (err) {
      setError((err as Error).message);
      setBusy(null);
    }
  };

  if (loading || !user || !details) {
    return <div className="flex justify-center py-24"><Loader2 className="h-6 w-6 animate-spin text-slate-400" /></div>;
  }

  const u = details.user;
  const paid = u.plan !== 'free';
  const { cloudTasksToday, cloudTasksPerDay, maxFileMb } = details.usage;

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-12 sm:px-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight text-slate-900 dark:text-white">Account</h1>
        <p className="mt-1 text-sm text-slate-500">{u.email}</p>
      </div>

      {awaitingUpgrade && (
        <Alert kind="info"><span className="inline-flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" /> Payment received — activating your plan…</span></Alert>
      )}
      {params.get('checkout') === 'success' && !awaitingUpgrade && paid && <Alert kind="success">Welcome to {PLAN_LABEL[u.plan]}! Your plan is active.</Alert>}
      {error && <Alert kind="error">{error}</Alert>}
      {u.planStatus === 'past_due' && (
        <Alert kind="error">
          <span className="inline-flex items-start gap-2"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /> Your last payment failed. Update your payment method to keep {PLAN_LABEL[u.plan]}.</span>
        </Alert>
      )}

      <Panel>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="text-sm text-slate-500">Current plan</div>
            <div className="mt-1 flex items-center gap-2">
              <span className="text-2xl font-semibold text-slate-900 dark:text-white">{PLAN_LABEL[u.plan]}</span>
              {paid && <span className="rounded-full bg-brand-100 px-2 py-0.5 text-xs font-semibold text-brand-800 dark:bg-brand-500/15 dark:text-brand-300">{u.planStatus}</span>}
            </div>
            {paid && (
              <p className="mt-1 text-sm text-slate-500">
                {u.cancelAtPeriodEnd ? `Ends on ${fmtDate(u.currentPeriodEnd)} — you won’t be charged again.` : `Renews on ${fmtDate(u.currentPeriodEnd)}.`}
              </p>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            {u.hasBillingAccount && (
              <Button variant="secondary" loading={busy === 'portal'} onClick={() => go('portal', accountApi.portal)}>
                <CreditCard className="h-4 w-4" /> Manage billing
              </Button>
            )}
            {!paid && (
              <Link href="/pricing" className="inline-flex h-11 items-center gap-2 rounded-xl bg-brand-600 px-5 text-sm font-semibold text-white shadow-lg shadow-brand-600/20 hover:bg-brand-700">
                <Sparkles className="h-4 w-4" /> Upgrade
              </Link>
            )}
          </div>
        </div>

        <div className="mt-8 grid gap-6 border-t border-slate-200 pt-6 sm:grid-cols-2 dark:border-white/10">
          <div>
            {cloudTasksPerDay === null ? (
              <div className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
                <CheckCircle2 className="h-4 w-4 text-brand-600" /> Unlimited cloud tasks · {cloudTasksToday} today
              </div>
            ) : (
              <Progress value={(cloudTasksToday / cloudTasksPerDay) * 100} label={`Cloud tasks today: ${cloudTasksToday} of ${cloudTasksPerDay}`} />
            )}
            <p className="mt-2 text-xs text-slate-500">Browser-based tools are always unlimited. Limits reset at midnight UTC.</p>
          </div>
          <div className="text-sm text-slate-700 dark:text-slate-300">
            Max file size: <span className="font-semibold">{maxFileMb >= 1024 ? `${maxFileMb / 1024} GB` : `${maxFileMb} MB`}</span>
          </div>
        </div>
      </Panel>

      <Panel>
        <h2 className="font-semibold text-slate-900 dark:text-white">Privacy & security</h2>
        <div className="mt-4 divide-y divide-slate-200 dark:divide-white/10">
          <div className="flex flex-wrap items-center justify-between gap-3 py-4">
            <div>
              <div className="text-sm font-medium text-slate-900 dark:text-white">Download your data</div>
              <div className="text-xs text-slate-500">Everything we store about your account, as JSON. We never store documents.</div>
            </div>
            <a href={accountApi.exportUrl()} className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200 px-4 text-sm font-medium text-slate-900 hover:bg-slate-50 dark:border-white/10 dark:text-white dark:hover:bg-white/5">
              <Download className="h-4 w-4" /> Export
            </a>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3 py-4">
            <div>
              <div className="text-sm font-medium text-slate-900 dark:text-white">Sign out everywhere</div>
              <div className="text-xs text-slate-500">{details.activeSessions} active session{details.activeSessions === 1 ? '' : 's'}</div>
            </div>
            <Button
              variant="secondary"
              className="!h-10"
              loading={busy === 'logout-all'}
              onClick={async () => { setBusy('logout-all'); await accountApi.logoutAll().catch(() => undefined); await signOut(); router.replace('/login'); }}
            >
              <LogOut className="h-4 w-4" /> Sign out all
            </Button>
          </div>
        </div>
      </Panel>

      <Panel className="border-red-200 dark:border-red-500/20">
        <h2 className="font-semibold text-red-700 dark:text-red-400">Delete account</h2>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
          Permanently deletes your account, sessions and usage history{paid ? ' and cancels your subscription immediately (no refund for the current period)' : ''}. Invoices remain with our payment provider as required by tax law. This cannot be undone.
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <input value={confirmText} onChange={(e) => setConfirmText(e.target.value)} placeholder="Type DELETE to confirm" className={`${inputCls} max-w-xs`} aria-label="Type DELETE to confirm account deletion" />
          <button
            onClick={deleteAccount}
            disabled={confirmText !== 'DELETE' || busy === 'delete'}
            className="inline-flex h-10 items-center gap-2 rounded-xl bg-red-600 px-4 text-sm font-semibold text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:bg-slate-300 dark:disabled:bg-white/10"
          >
            {busy === 'delete' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />} Delete my account
          </button>
        </div>
      </Panel>
    </div>
  );
}
