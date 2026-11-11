import React from 'react';
import Link from 'next/link';
import {
  ArrowRight, ShieldCheck, Laptop, Timer, Zap, Lock, Globe2, Check, Sparkles, Download,
} from 'lucide-react';
import { HeroDropzone } from '@/components/home/HeroDropzone';
import { ToolGrid } from '@/components/home/ToolGrid';
import { FaqList } from '@/components/ui/FaqList';
import { PDF_TOOLS, POPULAR_TOOLS } from '@/lib/tools-data';
import { ToolIcon } from '@/components/ui/ToolIcon';

const clientCount = PDF_TOOLS.filter((t) => t.processing === 'client').length;

const PILLARS = [
  {
    icon: Laptop,
    title: 'Runs on your device',
    body: `${clientCount} of ${PDF_TOOLS.length} tools process files with WebAssembly right in your browser. Nothing is uploaded — it even works offline in the desktop app.`,
  },
  {
    icon: Timer,
    title: 'Deleted within 2 hours',
    body: 'When a task needs heavy lifting — OCR, Office conversion, compression — files are processed in isolated workers and purged automatically.',
  },
  {
    icon: Zap,
    title: 'Instant results',
    body: 'No upload queue for everyday tasks — results are ready as fast as your own device can produce them.',
  },
];

const FAQ = [
  {
    q: 'Are my files uploaded to your servers?',
    a: 'For most tools, no. Merging, splitting, rotating, cropping, watermarking, image conversion and editing happen entirely in your browser. Tools marked “Cloud” (OCR, Office conversion, compression, encryption) upload the file over an encrypted connection, process it, and delete it automatically within 2 hours.',
  },
  {
    q: 'Is EyeShots free?',
    a: 'Yes. The free plan covers every browser-based tool and a daily allowance of cloud tasks, for files up to 100 MB. Pro removes limits, adds batch processing and priority processing.',
  },
  {
    q: 'Do I need an account?',
    a: 'No account is needed for free tools. An account is only required to manage a Pro subscription.',
  },
  {
    q: 'Is there a desktop app?',
    a: 'Yes. The desktop app for Windows, macOS and Linux bundles the same tools and keeps every file on your computer.',
  },
];

export default function HomePage() {
  return (
    <div className="overflow-x-clip">
      {/* ── Hero ─────────────────────────────────────────── */}
      <section className="relative -mt-16 pt-16">
        <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
          <div className="bg-grid mask-fade-b absolute inset-0" />
          <div className="absolute left-1/2 top-[-12rem] h-[36rem] w-[60rem] -translate-x-1/2 rounded-full bg-gradient-to-tr from-brand-300/40 via-sky-200/30 to-violet-200/30 blur-3xl dark:from-brand-500/15 dark:via-sky-500/10 dark:to-violet-500/10" />
        </div>

        <div className="mx-auto max-w-4xl px-4 pb-16 pt-16 text-center sm:px-6 sm:pt-24">
          <Link
            href="/jpg-to-pdf"
            className="mb-6 inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white/80 py-1 pl-1 pr-3 text-xs font-medium text-slate-600 shadow-sm backdrop-blur animate-fade-up hover:border-brand-300 dark:border-white/10 dark:bg-white/5 dark:text-slate-300"
          >
            <span className="rounded-full bg-brand-600 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">New</span>
            Images ↔ PDF, Crop and Office conversion
            <ArrowRight className="h-3 w-3" />
          </Link>

          <h1 className="text-balance text-4xl font-semibold tracking-tight text-slate-900 animate-fade-up [animation-delay:60ms] sm:text-6xl dark:text-white">
            Every PDF tool you need.{' '}
            <span className="text-gradient-brand">None of the uploading.</span>
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-pretty text-lg leading-relaxed text-slate-600 animate-fade-up [animation-delay:120ms] dark:text-slate-400">
            Edit, convert, compress, merge and sign PDFs in seconds. Most tools run entirely in your browser, so your documents never leave your device.
          </p>

          <div className="mx-auto mt-10 max-w-2xl animate-fade-up [animation-delay:180ms]">
            <HeroDropzone />
          </div>

          <ul className="mt-8 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm text-slate-500 dark:text-slate-400">
            {['No sign-up required', 'Free up to 100 MB', 'Files auto-deleted in 2 h'].map((t) => (
              <li key={t} className="flex items-center gap-1.5">
                <Check className="h-4 w-4 text-brand-600 dark:text-brand-400" /> {t}
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* ── Popular strip ───────────────────────────────── */}
      <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex flex-wrap items-center justify-center gap-2">
          {POPULAR_TOOLS.slice(0, 8).map((t) => (
            <Link
              key={t.id}
              href={t.path}
              className="group inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white py-1.5 pl-1.5 pr-4 text-sm font-medium text-slate-700 shadow-sm transition hover:border-brand-300 hover:text-slate-900 dark:border-white/10 dark:bg-white/[0.03] dark:text-slate-300 dark:hover:border-brand-500/40 dark:hover:text-white"
            >
              <ToolIcon tool={t} size="sm" className="!h-7 !w-7 !rounded-full" />
              {t.shortName ?? t.name}
            </Link>
          ))}
        </div>
      </section>

      {/* ── All tools ───────────────────────────────────── */}
      <section id="all-tools" className="mx-auto max-w-7xl scroll-mt-24 px-4 pt-24 sm:px-6 lg:px-8">
        <div className="mx-auto mb-10 max-w-2xl text-center">
          <h2 className="text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl dark:text-white">
            {PDF_TOOLS.length} tools, one simple workspace
          </h2>
          <p className="mt-3 text-slate-600 dark:text-slate-400">
            Press <kbd className="rounded border border-slate-300 bg-white px-1.5 py-0.5 font-sans text-xs dark:border-white/15 dark:bg-white/5">/</kbd> anywhere to jump straight to a tool.
          </p>
        </div>
        <ToolGrid />
      </section>

      {/* ── Privacy pillars ─────────────────────────────── */}
      <section className="mx-auto max-w-7xl px-4 pt-28 sm:px-6 lg:px-8">
        <div className="relative overflow-hidden rounded-3xl bg-slate-950 px-6 py-14 text-white ring-1 ring-white/10 sm:px-12 sm:py-16 dark:bg-slate-900/60">
          <div aria-hidden className="absolute -right-24 -top-24 h-80 w-80 rounded-full bg-brand-500/25 blur-3xl" />
          <div aria-hidden className="absolute -bottom-32 left-10 h-72 w-72 rounded-full bg-sky-500/15 blur-3xl" />
          <div className="relative grid gap-12 lg:grid-cols-5">
            <div className="lg:col-span-2">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-xs font-medium text-brand-300">
                <ShieldCheck className="h-3.5 w-3.5" /> Privacy architecture
              </span>
              <h2 className="mt-5 text-3xl font-semibold tracking-tight sm:text-4xl">Your documents are none of our business.</h2>
              <p className="mt-4 leading-relaxed text-slate-400">
                EyeShots is built client-first. We only touch a file when your browser physically can’t do the job — and even then, we don’t keep it.
              </p>
              <Link href="/privacy" className="mt-6 inline-flex items-center gap-1.5 text-sm font-medium text-brand-300 hover:text-brand-200">
                Read how we handle data <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
            <div className="grid gap-6 sm:grid-cols-3 lg:col-span-3">
              {PILLARS.map(({ icon: Icon, title, body }) => (
                <div key={title} className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
                  <Icon className="h-6 w-6 text-brand-400" />
                  <h3 className="mt-4 font-semibold">{title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-slate-400">{body}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── Feature split ───────────────────────────────── */}
      <section className="mx-auto grid max-w-7xl gap-6 px-4 pt-24 sm:px-6 md:grid-cols-3 lg:px-8">
        {[
          { icon: Lock, title: 'Bank-grade encryption', body: 'AES-256 password protection, and encrypted transport for every cloud task.' },
          { icon: Globe2, title: 'OCR in 100+ languages', body: 'Turn scans into searchable, selectable text with Tesseract 5.' },
          { icon: Download, title: 'Desktop app', body: 'Windows, macOS and Linux. The same tools in a lightweight native app.' },
        ].map(({ icon: Icon, title, body }) => (
          <div key={title} className="rounded-2xl border border-slate-200 bg-white p-6 dark:border-white/[0.08] dark:bg-white/[0.03]">
            <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50 text-brand-600 dark:bg-brand-500/10 dark:text-brand-400">
              <Icon className="h-5 w-5" />
            </span>
            <h3 className="mt-4 font-semibold text-slate-900 dark:text-white">{title}</h3>
            <p className="mt-1.5 text-sm leading-relaxed text-slate-600 dark:text-slate-400">{body}</p>
          </div>
        ))}
      </section>

      {/* ── FAQ ─────────────────────────────────────────── */}
      <section className="mx-auto max-w-3xl px-4 pt-24 sm:px-6">
        <h2 className="text-center text-3xl font-semibold tracking-tight text-slate-900 dark:text-white">Questions, answered</h2>
        <div className="mt-10">
          <FaqList items={FAQ} />
        </div>
      </section>

      {/* ── CTA ─────────────────────────────────────────── */}
      <section className="mx-auto max-w-4xl px-4 pt-24 text-center sm:px-6">
        <Sparkles className="mx-auto h-8 w-8 text-brand-500" />
        <h2 className="mt-4 text-3xl font-semibold tracking-tight text-slate-900 dark:text-white">Do more with EyeShots Pro</h2>
        <p className="mx-auto mt-3 max-w-xl text-slate-600 dark:text-slate-400">
          Unlimited cloud tasks, 1 GB files, batch processing and priority OCR.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link href="/pricing" className="inline-flex h-11 items-center gap-2 rounded-xl bg-brand-600 px-6 text-sm font-semibold text-white shadow-lg shadow-brand-600/25 transition hover:bg-brand-700">
            See plans <ArrowRight className="h-4 w-4" />
          </Link>
          <Link href="/edit-pdf" className="inline-flex h-11 items-center rounded-xl border border-slate-200 bg-white px-6 text-sm font-semibold text-slate-900 transition hover:bg-slate-50 dark:border-white/10 dark:bg-white/5 dark:text-white dark:hover:bg-white/10">
            Open the editor
          </Link>
        </div>
      </section>

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'FAQPage',
            mainEntity: FAQ.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })),
          }),
        }}
      />
    </div>
  );
}
