import React from 'react';
import { ChevronDown } from 'lucide-react';

/** Accessible FAQ list built on native <details> — works without JavaScript. */
export function FaqList({ items }: { items: { q: string; a: string }[] }) {
  return (
    <div className="divide-y divide-slate-200 overflow-hidden rounded-2xl border border-slate-200 bg-white dark:divide-white/[0.08] dark:border-white/[0.08] dark:bg-white/[0.02]">
      {items.map((item) => (
        <details key={item.q} className="group px-5 py-1 [&_summary::-webkit-details-marker]:hidden">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-4 py-4 text-left font-medium text-slate-900 dark:text-white">
            {item.q}
            <ChevronDown className="h-4 w-4 shrink-0 text-slate-400 transition-transform group-open:rotate-180" />
          </summary>
          <p className="pb-5 text-sm leading-relaxed text-slate-600 dark:text-slate-400">{item.a}</p>
        </details>
      ))}
    </div>
  );
}
