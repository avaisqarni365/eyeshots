import React from 'react';
import Link from 'next/link';
import { ChevronRight, Laptop, Cloud, ShieldCheck } from 'lucide-react';
import { getTool, relatedTools } from '@/lib/tools-data';
import { ToolIcon } from './ToolIcon';
import { ToolCard } from './ToolCard';
import { FaqList } from './FaqList';

interface Props {
  toolId: string;
  /** Override the H1 (defaults to the registry name). */
  title?: string;
  subtitle?: string;
  steps?: string[];
  faq?: { q: string; a: string }[];
  children: React.ReactNode;
}

/**
 * Standard chrome for every tool page: breadcrumb, header, privacy notice,
 * "how it works", FAQ (with FAQPage JSON-LD) and related tools.
 */
export function ToolPageShell({ toolId, title, subtitle, steps, faq, children }: Props) {
  const tool = getTool(toolId);
  if (!tool) return <>{children}</>;
  const isClient = tool.processing === 'client';

  return (
    <div className="relative">
      <div aria-hidden className="pointer-events-none absolute inset-x-0 -top-16 -z-10 h-[28rem]">
        <div className="bg-grid mask-fade-b absolute inset-0" />
      </div>

      <div className="mx-auto max-w-5xl px-4 pb-8 pt-8 sm:px-6 lg:px-8">
        <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-xs text-slate-500">
          <Link href="/" className="hover:text-slate-900 dark:hover:text-white">Home</Link>
          <ChevronRight className="h-3.5 w-3.5" />
          <span className="font-medium text-slate-900 dark:text-white">{tool.name}</span>
        </nav>

        <header className="mt-8 flex flex-col items-center text-center">
          <ToolIcon tool={tool} size="lg" />
          <h1 className="mt-5 text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl dark:text-white">{title ?? tool.name}</h1>
          <p className="mt-3 max-w-xl text-pretty text-slate-600 dark:text-slate-400">{subtitle ?? tool.description}</p>
          <span
            className={`mt-4 inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ring-1 ring-inset ${
              isClient
                ? 'bg-brand-50 text-brand-700 ring-brand-600/15 dark:bg-brand-500/10 dark:text-brand-300 dark:ring-brand-400/20'
                : 'bg-slate-100 text-slate-600 ring-slate-600/10 dark:bg-white/5 dark:text-slate-300 dark:ring-white/10'
            }`}
          >
            {isClient ? <Laptop className="h-3.5 w-3.5" /> : <Cloud className="h-3.5 w-3.5" />}
            {isClient ? 'Processed in your browser — files never leave your device' : 'Processed securely in the cloud — deleted within 2 hours'}
          </span>
        </header>

        <div className="mt-10">{children}</div>
      </div>

      {steps && steps.length > 0 && (
        <section className="mx-auto max-w-5xl px-4 pt-16 sm:px-6 lg:px-8">
          <h2 className="text-center text-xl font-semibold tracking-tight text-slate-900 dark:text-white">How to use {tool.name}</h2>
          <ol className="mt-8 grid gap-4 sm:grid-cols-3">
            {steps.map((s, i) => (
              <li key={i} className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-white/[0.08] dark:bg-white/[0.02]">
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-brand-600 text-xs font-semibold text-white">{i + 1}</span>
                <p className="mt-3 text-sm leading-relaxed text-slate-600 dark:text-slate-400">{s}</p>
              </li>
            ))}
          </ol>
        </section>
      )}

      {faq && faq.length > 0 && (
        <section className="mx-auto max-w-3xl px-4 pt-16 sm:px-6">
          <h2 className="text-center text-xl font-semibold tracking-tight text-slate-900 dark:text-white">Frequently asked questions</h2>
          <div className="mt-8"><FaqList items={faq} /></div>
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{
              __html: JSON.stringify({
                '@context': 'https://schema.org',
                '@type': 'FAQPage',
                mainEntity: faq.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })),
              }),
            }}
          />
        </section>
      )}

      <section className="mx-auto max-w-5xl px-4 pt-16 sm:px-6 lg:px-8">
        <div className="mb-5 flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-white">
          <ShieldCheck className="h-4 w-4 text-brand-600" /> Related tools
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {relatedTools(toolId).map((t) => <ToolCard key={t.id} tool={t} />)}
        </div>
      </section>
    </div>
  );
}
