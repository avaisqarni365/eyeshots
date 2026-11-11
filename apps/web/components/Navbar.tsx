'use client';

import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ChevronDown, Search, Menu, X, Command } from 'lucide-react';
import { PDF_TOOLS, TOOL_CATEGORIES, toolsInCategory } from '@/lib/tools-data';
import { ToolIcon } from '@/components/ui/ToolIcon';
import { ThemeToggle } from '@/components/ui/ThemeToggle';
import { openCommandPalette } from '@/components/ui/CommandPalette';
import { Logo } from '@/components/ui/Logo';
import { AccountMenu } from '@/components/auth/AccountMenu';
import { useAuth } from '@/components/auth/AuthProvider';

const PRIMARY_LINKS = [
  { href: '/edit-pdf', label: 'Edit' },
  { href: '/compress-pdf', label: 'Compress' },
  { href: '/merge-pdf', label: 'Merge' },
  { href: '/fill-and-sign', label: 'Sign' },
  { href: '/pricing', label: 'Pricing' },
];

export const Navbar: React.FC = () => {
  const pathname = usePathname();
  const { user } = useAuth();
  const [megaOpen, setMegaOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [isMac, setIsMac] = useState(false);
  const megaRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMegaOpen(false);
    setMobileOpen(false);
  }, [pathname]);

  useEffect(() => {
    setIsMac(/Mac|iPhone|iPad/.test(navigator.platform));
    const onScroll = () => setScrolled(window.scrollY > 4);
    const onDown = (e: MouseEvent) => {
      if (megaRef.current && !megaRef.current.contains(e.target as Node)) setMegaOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setMegaOpen(false);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('scroll', onScroll);
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, []);

  return (
    <header
      className={`sticky top-0 z-50 w-full border-b transition-colors duration-200 ${
        scrolled
          ? 'border-slate-200/80 bg-white/80 backdrop-blur-xl dark:border-white/[0.08] dark:bg-slate-950/80'
          : 'border-transparent bg-white/0 dark:bg-slate-950/0'
      }`}
    >
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-6" ref={megaRef}>
          <Link href="/" aria-label="EyeShots home" className="shrink-0">
            <Logo />
          </Link>

          <nav className="hidden items-center gap-1 lg:flex" aria-label="Main">
            <div className="relative">
              <button
                onClick={() => setMegaOpen((o) => !o)}
                aria-expanded={megaOpen}
                aria-haspopup="true"
                className={`flex items-center gap-1 rounded-lg px-3 py-2 text-sm font-medium transition ${
                  megaOpen ? 'bg-slate-100 text-slate-900 dark:bg-white/10 dark:text-white' : 'text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white'
                }`}
              >
                All tools
                <ChevronDown className={`h-4 w-4 transition-transform ${megaOpen ? 'rotate-180' : ''}`} />
              </button>

              {megaOpen && (
                <div className="absolute left-0 top-12 z-50 w-[min(1040px,calc(100vw-4rem))] rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl shadow-slate-900/10 animate-fade-in dark:border-white/10 dark:bg-slate-900">
                  <div className="grid grid-cols-4 gap-x-6 gap-y-7">
                    {TOOL_CATEGORIES.map((cat) => (
                      <div key={cat.id}>
                        <div className="mb-2 px-2 text-[11px] font-semibold uppercase tracking-wider text-slate-400">{cat.label}</div>
                        <ul className="space-y-0.5">
                          {toolsInCategory(cat.id).map((tool) => (
                            <li key={tool.id}>
                              <Link
                                href={tool.path}
                                className="group flex items-center gap-2.5 rounded-lg px-2 py-1.5 text-sm text-slate-700 transition hover:bg-slate-50 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-white/5 dark:hover:text-white"
                              >
                                <ToolIcon tool={tool} size="sm" className="!h-7 !w-7" />
                                <span className="flex-1">{tool.name}</span>
                                {tool.isNew && <span className="rounded bg-brand-100 px-1.5 text-[10px] font-semibold text-brand-700 dark:bg-brand-500/15 dark:text-brand-300">New</span>}
                              </Link>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>
                  <div className="mt-6 flex items-center justify-between rounded-xl bg-slate-50 px-4 py-3 text-xs text-slate-500 dark:bg-white/[0.03] dark:text-slate-400">
                    <span>{PDF_TOOLS.length} tools · most run entirely in your browser</span>
                    <button onClick={() => { setMegaOpen(false); openCommandPalette(); }} className="font-medium text-brand-600 hover:underline dark:text-brand-400">
                      Search all tools →
                    </button>
                  </div>
                </div>
              )}
            </div>

            {PRIMARY_LINKS.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className={`rounded-lg px-3 py-2 text-sm font-medium transition ${
                  pathname === l.href ? 'text-slate-900 dark:text-white' : 'text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white'
                }`}
              >
                {l.label}
              </Link>
            ))}
          </nav>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            onClick={openCommandPalette}
            className="hidden h-9 items-center gap-2 rounded-lg border border-slate-200 bg-white/60 pl-3 pr-1.5 text-sm text-slate-500 transition hover:border-slate-300 hover:text-slate-700 md:flex dark:border-white/10 dark:bg-white/5 dark:text-slate-400 dark:hover:border-white/20"
          >
            <Search className="h-4 w-4" />
            <span className="pr-6">Find a tool…</span>
            <kbd className="flex items-center gap-0.5 rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[10px] font-medium text-slate-500 dark:border-white/10 dark:bg-white/5">
              {isMac ? <Command className="h-2.5 w-2.5" /> : 'Ctrl'} K
            </kbd>
          </button>
          <button onClick={openCommandPalette} aria-label="Search tools" className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 md:hidden dark:text-slate-400 dark:hover:bg-white/5">
            <Search className="h-[18px] w-[18px]" />
          </button>
          <ThemeToggle />
          <AccountMenu />
          <button
            onClick={() => setMobileOpen((o) => !o)}
            aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={mobileOpen}
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-slate-600 hover:bg-slate-100 lg:hidden dark:text-slate-300 dark:hover:bg-white/5"
          >
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {mobileOpen && (
        <div className="max-h-[calc(100vh-4rem)] overflow-y-auto border-t border-slate-200 bg-white px-4 pb-8 pt-4 animate-fade-in lg:hidden dark:border-white/10 dark:bg-slate-950">
          {TOOL_CATEGORIES.map((cat) => (
            <div key={cat.id} className="mb-5">
              <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400">{cat.label}</div>
              <div className="grid grid-cols-2 gap-1">
                {toolsInCategory(cat.id).map((tool) => (
                  <Link key={tool.id} href={tool.path} className="flex items-center gap-2 rounded-lg px-2 py-2 text-sm text-slate-700 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-white/5">
                    <ToolIcon tool={tool} size="sm" className="!h-7 !w-7" />
                    <span className="truncate">{tool.shortName ?? tool.name}</span>
                  </Link>
                ))}
              </div>
            </div>
          ))}
          <div className="mt-2 grid grid-cols-2 gap-2">
            <Link href={user ? '/account' : '/login'} className="flex h-11 items-center justify-center rounded-xl border border-slate-200 text-sm font-medium text-slate-900 dark:border-white/10 dark:text-white">
              {user ? 'Account' : 'Sign in'}
            </Link>
            <Link href="/pricing" className="flex h-11 items-center justify-center rounded-xl bg-slate-900 text-sm font-medium text-white dark:bg-white dark:text-slate-900">
              See pricing
            </Link>
          </div>
        </div>
      )}
    </header>
  );
};
