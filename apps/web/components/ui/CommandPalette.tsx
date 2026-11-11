'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Search, CornerDownLeft, ArrowUp, ArrowDown } from 'lucide-react';
import { PDF_TOOLS, POPULAR_TOOLS, PROCESSING_LABEL, searchTools, TOOL_CATEGORIES } from '@/lib/tools-data';
import { ToolIcon } from './ToolIcon';

const OPEN_EVENT = 'eyeshots:open-command-palette';

export function openCommandPalette() {
  window.dispatchEvent(new Event(OPEN_EVENT));
}

export function CommandPalette() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const results = useMemo(() => (query.trim() ? searchTools(query) : POPULAR_TOOLS), [query]);

  const close = useCallback(() => {
    setOpen(false);
    setQuery('');
    setActive(0);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen((o) => !o);
      } else if (e.key === '/' && !open) {
        const t = e.target as HTMLElement;
        if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
        e.preventDefault();
        setOpen(true);
      }
    };
    const onOpen = () => setOpen(true);
    window.addEventListener('keydown', onKey);
    window.addEventListener(OPEN_EVENT, onOpen);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener(OPEN_EVENT, onOpen);
    };
  }, [open]);

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 0);
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  useEffect(() => setActive(0), [query]);

  useEffect(() => {
    const el = listRef.current?.querySelector<HTMLElement>(`[data-index="${active}"]`);
    el?.scrollIntoView({ block: 'nearest' });
  }, [active]);

  const go = (path: string) => {
    close();
    router.push(path);
  };

  if (!open) return null;

  const categoryLabel = (id: string) => TOOL_CATEGORIES.find((c) => c.id === id)?.label ?? '';

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center bg-slate-950/50 p-4 pt-[12vh] backdrop-blur-sm animate-fade-in" onMouseDown={close}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Search tools"
        className="w-full max-w-xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl shadow-slate-950/20 dark:border-white/10 dark:bg-slate-900"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 border-b border-slate-200 px-4 dark:border-white/10">
          <Search className="h-5 w-5 text-slate-400" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') close();
              else if (e.key === 'ArrowDown') { e.preventDefault(); setActive((a) => Math.min(a + 1, results.length - 1)); }
              else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)); }
              else if (e.key === 'Enter' && results[active]) go(results[active].path);
            }}
            placeholder={`Search ${PDF_TOOLS.length} tools — merge, compress, sign…`}
            className="h-14 w-full bg-transparent text-[15px] text-slate-900 placeholder:text-slate-400 focus:outline-none dark:text-white"
            aria-controls="command-results"
          />
          <kbd className="hidden rounded-md border border-slate-200 px-1.5 py-0.5 text-[10px] font-medium text-slate-400 sm:block dark:border-white/10">ESC</kbd>
        </div>

        <div className="px-2 pb-2 pt-2">
          <div className="px-2 pb-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
            {query.trim() ? `${results.length} result${results.length === 1 ? '' : 's'}` : 'Popular tools'}
          </div>
          {results.length === 0 ? (
            <div className="px-3 py-10 text-center text-sm text-slate-500">No tools match “{query}”.</div>
          ) : (
            <ul id="command-results" ref={listRef} role="listbox" className="max-h-[50vh] overflow-y-auto">
              {results.map((tool, i) => (
                <li key={tool.id} data-index={i} role="option" aria-selected={i === active}>
                  <button
                    type="button"
                    onMouseMove={() => setActive(i)}
                    onClick={() => go(tool.path)}
                    className={`flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-left transition ${
                      i === active ? 'bg-slate-100 dark:bg-white/5' : ''
                    }`}
                  >
                    <ToolIcon tool={tool} size="sm" />
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-medium text-slate-900 dark:text-white">{tool.name}</span>
                      <span className="block truncate text-xs text-slate-500 dark:text-slate-400">{tool.description}</span>
                    </span>
                    <span className="hidden shrink-0 text-[11px] text-slate-400 sm:block">{categoryLabel(tool.category)}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="flex items-center justify-between border-t border-slate-200 bg-slate-50 px-4 py-2 text-[11px] text-slate-500 dark:border-white/10 dark:bg-white/[0.02]">
          <span className="flex items-center gap-3">
            <span className="flex items-center gap-1"><ArrowUp className="h-3 w-3" /><ArrowDown className="h-3 w-3" /> navigate</span>
            <span className="flex items-center gap-1"><CornerDownLeft className="h-3 w-3" /> open</span>
          </span>
          {results[active] && <span>{PROCESSING_LABEL[results[active].processing]}</span>}
        </div>
      </div>
    </div>
  );
}
