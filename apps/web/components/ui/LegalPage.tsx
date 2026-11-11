import React from 'react';

export function LegalPage({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <article className="mx-auto max-w-3xl px-4 py-16 text-slate-700 sm:px-6 dark:text-slate-300 [&_h2]:mt-10 [&_h2]:text-xl [&_h2]:font-semibold [&_h2]:text-slate-900 dark:[&_h2]:text-white [&_li]:mt-1 [&_p]:mt-4 [&_p]:leading-relaxed [&_ul]:mt-4 [&_ul]:list-disc [&_ul]:pl-6">
      <h1 className="text-4xl font-semibold tracking-tight text-slate-900 dark:text-white">{title}</h1>
      <p className="!mt-3 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:bg-amber-500/10 dark:text-amber-300">
        Template — placeholders in [brackets] must be completed and the text reviewed by legal counsel before launch.
      </p>
      {children}
    </article>
  );
}
