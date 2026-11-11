import React from 'react';
import Link from 'next/link';
import { ArrowUpRight, Laptop, Cloud } from 'lucide-react';
import type { PdfTool } from '@/lib/tools-data';
import { ToolIcon } from './ToolIcon';

export function ProcessingBadge({ processing }: { processing: PdfTool['processing'] }) {
  if (processing === 'client') {
    return (
      <span className="inline-flex items-center gap-1 text-[11px] font-medium text-brand-700 dark:text-brand-400" title="Processed entirely in your browser — the file never leaves your device">
        <Laptop className="h-3 w-3" /> In browser
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-500 dark:text-slate-400" title="Processed on our servers and deleted automatically within 2 hours">
      <Cloud className="h-3 w-3" /> {processing === 'hybrid' ? 'Browser + cloud' : 'Cloud · auto-deleted'}
    </span>
  );
}

export function ToolCard({ tool }: { tool: PdfTool }) {
  return (
    <Link
      href={tool.path}
      className="group relative flex h-full flex-col gap-3 rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm shadow-slate-900/[0.02] transition-all duration-200 hover:-translate-y-0.5 hover:border-brand-300 hover:shadow-lg hover:shadow-brand-900/[0.06] dark:border-white/[0.08] dark:bg-white/[0.03] dark:hover:border-brand-500/40 dark:hover:bg-white/[0.05]"
    >
      <div className="flex items-start justify-between">
        <ToolIcon tool={tool} />
        <div className="flex items-center gap-1.5">
          {tool.isNew && (
            <span className="rounded-full bg-brand-600 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">New</span>
          )}
          {tool.plan === 'pro' && (
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-800 dark:bg-amber-500/15 dark:text-amber-300">Pro</span>
          )}
          <ArrowUpRight className="h-4 w-4 text-slate-300 opacity-0 transition group-hover:opacity-100 dark:text-slate-600" />
        </div>
      </div>
      <div className="flex-1 space-y-1">
        <h3 className="text-[15px] font-semibold tracking-tight text-slate-900 group-hover:text-brand-700 dark:text-white dark:group-hover:text-brand-300">
          {tool.name}
        </h3>
        <p className="text-sm leading-relaxed text-slate-500 dark:text-slate-400">{tool.description}</p>
      </div>
      <ProcessingBadge processing={tool.processing} />
    </Link>
  );
}
