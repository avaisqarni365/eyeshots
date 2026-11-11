'use client';

import React, { useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Mail, ShieldCheck } from 'lucide-react';
import { accountApi } from '@/lib/api/account-client';
import { useAuth } from './AuthProvider';
import { safeNext } from '@/lib/auth/safe-next';
import { Alert, Button, Field, Panel, inputCls } from '@/components/ui/primitives';
import { Logo } from '@/components/ui/Logo';

export function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const next = safeNext(params.get('next'));
  const { user, refresh, enabled, loading } = useAuth();

  const [step, setStep] = useState<'email' | 'code'>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);
  const codeRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!loading && user) router.replace(next);
  }, [loading, user, next, router]);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  const sendCode = async (e?: React.FormEvent) => {
    e?.preventDefault();
    setBusy(true); setError(null);
    try {
      await accountApi.requestCode(email);
      setStep('code');
      setCode('');
      setCooldown(30);
      setTimeout(() => codeRef.current?.focus(), 50);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const verify = async (value = code) => {
    if (value.replace(/\D/g, '').length !== 6) return;
    setBusy(true); setError(null);
    try {
      await accountApi.verify(email, value.replace(/\D/g, ''));
      await refresh();
      router.replace(next);
    } catch (err) {
      setError((err as Error).message);
      setCode('');
      codeRef.current?.focus();
    } finally {
      setBusy(false);
    }
  };

  if (!loading && !enabled) {
    return (
      <Panel className="mx-auto max-w-md text-center">
        <p className="text-sm text-slate-600 dark:text-slate-400">Accounts aren’t available on this server yet. All browser tools work without signing in.</p>
        <Link href="/" className="mt-4 inline-block text-sm font-medium text-brand-600 hover:underline">Back to tools</Link>
      </Panel>
    );
  }

  return (
    <div className="mx-auto w-full max-w-md">
      <div className="mb-8 flex flex-col items-center text-center">
        <Logo showText={false} />
        <h1 className="mt-5 text-2xl font-semibold tracking-tight text-slate-900 dark:text-white">
          {step === 'email' ? 'Sign in to EyeShots' : 'Check your email'}
        </h1>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
          {step === 'email' ? 'No password needed — we’ll email you a 6-digit code.' : <>We sent a code to <span className="font-medium text-slate-900 dark:text-white">{email}</span>.</>}
        </p>
      </div>

      <Panel>
        {step === 'email' ? (
          <form onSubmit={sendCode} className="space-y-5">
            <Field label="Email address">
              <input
                type="email"
                required
                autoFocus
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@company.com"
                className={inputCls}
              />
            </Field>
            {error && <Alert kind="error">{error}</Alert>}
            <Button type="submit" loading={busy} className="w-full"><Mail className="h-4 w-4" /> Email me a code</Button>
            <p className="text-center text-xs text-slate-500">New here? The same code creates your free account.</p>
          </form>
        ) : (
          <form onSubmit={(e) => { e.preventDefault(); void verify(); }} className="space-y-5">
            <Field label="6-digit code">
              <input
                ref={codeRef}
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={7}
                value={code}
                onChange={(e) => {
                  const v = e.target.value.replace(/[^\d ]/g, '');
                  setCode(v);
                  if (v.replace(/\D/g, '').length === 6) void verify(v); // auto-submit on paste / last digit
                }}
                placeholder="123 456"
                className={`${inputCls} h-14 text-center font-mono text-2xl tracking-[0.4em]`}
                aria-describedby="code-help"
              />
            </Field>
            <p id="code-help" className="-mt-2 text-xs text-slate-500">The code expires in 10 minutes. Check your spam folder if it doesn’t arrive.</p>
            {error && <Alert kind="error">{error}</Alert>}
            <Button type="submit" loading={busy} disabled={code.replace(/\D/g, '').length !== 6} className="w-full">Sign in</Button>
            <div className="flex items-center justify-between text-sm">
              <button type="button" onClick={() => { setStep('email'); setError(null); }} className="inline-flex items-center gap-1 text-slate-500 hover:text-slate-900 dark:hover:text-white">
                <ArrowLeft className="h-4 w-4" /> Change email
              </button>
              <button type="button" onClick={() => void sendCode()} disabled={cooldown > 0 || busy} className="font-medium text-brand-600 hover:underline disabled:cursor-not-allowed disabled:text-slate-400 disabled:no-underline dark:text-brand-400">
                {cooldown > 0 ? `Resend in ${cooldown}s` : 'Resend code'}
              </button>
            </div>
          </form>
        )}
      </Panel>

      <p className="mt-6 flex items-center justify-center gap-1.5 text-center text-xs text-slate-500">
        <ShieldCheck className="h-3.5 w-3.5 text-brand-600" /> We only store your email address. Never your documents.
      </p>
    </div>
  );
}
