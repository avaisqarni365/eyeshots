'use client';

import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { LogOut, Settings, Sparkles } from 'lucide-react';
import { useAuth } from './AuthProvider';
import { PLAN_LABEL } from '@/lib/api/account-client';

export function AccountMenu() {
  const { user, loading, enabled, signOut } = useAuth();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onDown = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && setOpen(false);
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey); };
  }, []);

  const proBtn = 'ml-1 hidden h-9 items-center rounded-lg bg-slate-900 px-4 text-sm font-medium text-white shadow-sm transition hover:bg-slate-800 sm:inline-flex dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100';

  if (loading) return <span className="ml-1 hidden h-9 w-20 animate-pulse rounded-lg bg-slate-100 sm:block dark:bg-white/5" />;

  if (!user) {
    return (
      <>
        {enabled && (
          <Link href="/login" className="hidden h-9 items-center rounded-lg px-3 text-sm font-medium text-slate-600 hover:text-slate-900 sm:inline-flex dark:text-slate-300 dark:hover:text-white">
            Sign in
          </Link>
        )}
        <Link href="/pricing" className={proBtn}>Get Pro</Link>
      </>
    );
  }

  const initial = user.email[0]?.toUpperCase() ?? '?';
  return (
    <div className="relative ml-1" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Account menu"
        className="flex h-9 items-center gap-2 rounded-lg pl-1 pr-2 text-sm hover:bg-slate-100 dark:hover:bg-white/5"
      >
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-brand-400 to-brand-700 text-xs font-semibold text-white">{initial}</span>
        {user.plan !== 'free' && <span className="hidden rounded bg-brand-100 px-1.5 text-[10px] font-semibold uppercase text-brand-800 sm:inline dark:bg-brand-500/15 dark:text-brand-300">{PLAN_LABEL[user.plan]}</span>}
      </button>
      {open && (
        <div role="menu" className="absolute right-0 top-11 z-50 w-64 rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl animate-fade-in dark:border-white/10 dark:bg-slate-900">
          <div className="px-3 py-2">
            <div className="truncate text-sm font-medium text-slate-900 dark:text-white">{user.email}</div>
            <div className="text-xs text-slate-500">{PLAN_LABEL[user.plan]} plan</div>
          </div>
          <div className="my-1 h-px bg-slate-100 dark:bg-white/10" />
          <Link role="menuitem" href="/account" onClick={() => setOpen(false)} className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-white/5">
            <Settings className="h-4 w-4" /> Account & billing
          </Link>
          {user.plan === 'free' && (
            <Link role="menuitem" href="/pricing" onClick={() => setOpen(false)} className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-brand-700 hover:bg-brand-50 dark:text-brand-300 dark:hover:bg-brand-500/10">
              <Sparkles className="h-4 w-4" /> Upgrade to Pro
            </Link>
          )}
          <button
            role="menuitem"
            onClick={async () => { setOpen(false); await signOut(); router.push('/'); }}
            className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-white/5"
          >
            <LogOut className="h-4 w-4" /> Sign out
          </button>
        </div>
      )}
    </div>
  );
}
