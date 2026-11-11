import React from 'react';
import Link from 'next/link';
import { ShieldCheck } from 'lucide-react';
import { TOOL_CATEGORIES, toolsInCategory } from '@/lib/tools-data';
import { Logo } from '@/components/ui/Logo';

const FOOTER_CATEGORIES = ['organize', 'edit', 'convert-to', 'convert-from'] as const;

export const Footer: React.FC = () => {
  return (
    <footer className="mt-24 border-t border-slate-200 bg-white dark:border-white/[0.08] dark:bg-slate-950">
      <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
        <div className="grid grid-cols-2 gap-10 md:grid-cols-6">
          <div className="col-span-2 space-y-4">
            <Logo />
            <p className="max-w-xs text-sm leading-relaxed text-slate-500 dark:text-slate-400">
              Privacy-first PDF tools. Most tasks run entirely in your browser; files that need our servers are deleted automatically within 2 hours.
            </p>
            <div className="inline-flex items-center gap-1.5 rounded-full border border-brand-200 bg-brand-50 px-3 py-1 text-xs font-medium text-brand-700 dark:border-brand-500/20 dark:bg-brand-500/10 dark:text-brand-300">
              <ShieldCheck className="h-3.5 w-3.5" /> Zero-retention by design
            </div>
          </div>

          {FOOTER_CATEGORIES.map((id) => {
            const cat = TOOL_CATEGORIES.find((c) => c.id === id)!;
            return (
              <div key={id}>
                <h4 className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-900 dark:text-slate-200">{cat.label}</h4>
                <ul className="space-y-2 text-sm">
                  {toolsInCategory(id).slice(0, 6).map((t) => (
                    <li key={t.id}>
                      <Link href={t.path} className="text-slate-500 transition hover:text-slate-900 dark:text-slate-400 dark:hover:text-white">
                        {t.name}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>

        <div className="mt-12 flex flex-col items-start justify-between gap-4 border-t border-slate-200 pt-6 text-sm text-slate-500 sm:flex-row sm:items-center dark:border-white/[0.08] dark:text-slate-400">
          <p>© {new Date().getFullYear()} EyeShots. All rights reserved.</p>
          <nav className="flex flex-wrap gap-x-6 gap-y-2" aria-label="Legal">
            <Link href="/pricing" className="hover:text-slate-900 dark:hover:text-white">Pricing</Link>
            <Link href="/privacy" className="hover:text-slate-900 dark:hover:text-white">Privacy</Link>
            <Link href="/terms" className="hover:text-slate-900 dark:hover:text-white">Terms</Link>
            <Link href="/imprint" className="hover:text-slate-900 dark:hover:text-white">Imprint</Link>
          </nav>
        </div>
      </div>
    </footer>
  );
};
