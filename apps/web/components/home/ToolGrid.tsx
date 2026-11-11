'use client';

import React, { useState } from 'react';
import { PDF_TOOLS, TOOL_CATEGORIES, type ToolCategoryId } from '@/lib/tools-data';
import { ToolCard } from '@/components/ui/ToolCard';

type Filter = 'all' | 'popular' | ToolCategoryId;

export function ToolGrid() {
  const [filter, setFilter] = useState<Filter>('all');

  const tools =
    filter === 'all' ? PDF_TOOLS : filter === 'popular' ? PDF_TOOLS.filter((t) => t.popular) : PDF_TOOLS.filter((t) => t.category === filter);

  const tabs: { id: Filter; label: string }[] = [
    { id: 'all', label: 'All tools' },
    { id: 'popular', label: 'Popular' },
    ...TOOL_CATEGORIES.map((c) => ({ id: c.id as Filter, label: c.label })),
  ];

  return (
    <div className="space-y-8">
      <div className="-mx-4 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0">
        <div role="tablist" aria-label="Tool categories" className="flex w-max gap-1.5 sm:w-auto sm:flex-wrap sm:justify-center">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              role="tab"
              aria-selected={filter === tab.id}
              onClick={() => setFilter(tab.id)}
              className={`whitespace-nowrap rounded-full px-4 py-2 text-sm font-medium transition ${
                filter === tab.id
                  ? 'bg-slate-900 text-white shadow-sm dark:bg-white dark:text-slate-900'
                  : 'bg-white text-slate-600 ring-1 ring-inset ring-slate-200 hover:bg-slate-50 hover:text-slate-900 dark:bg-white/5 dark:text-slate-300 dark:ring-white/10 dark:hover:bg-white/10'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {tools.map((tool) => (
          <ToolCard key={tool.id} tool={tool} />
        ))}
      </div>
    </div>
  );
}
