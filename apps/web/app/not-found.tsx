import Link from 'next/link';
import { POPULAR_TOOLS } from '@/lib/tools-data';
import { ToolCard } from '@/components/ui/ToolCard';

export default function NotFound() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-24 text-center sm:px-6">
      <p className="text-sm font-semibold text-brand-600">404</p>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl dark:text-white">This page doesn’t exist</h1>
      <p className="mt-3 text-slate-600 dark:text-slate-400">The tool may have moved. Try one of these, or press <kbd className="rounded border border-slate-300 px-1.5 text-xs dark:border-white/15">/</kbd> to search.</p>
      <div className="mt-10 grid gap-3 text-left sm:grid-cols-2 lg:grid-cols-4">
        {POPULAR_TOOLS.slice(0, 4).map((t) => <ToolCard key={t.id} tool={t} />)}
      </div>
      <Link href="/" className="mt-10 inline-block text-sm font-medium text-brand-600 hover:underline">← Back to all tools</Link>
    </div>
  );
}
