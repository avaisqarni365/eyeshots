'use client';

import React, { useEffect, useState } from 'react';
import { Moon, Sun, Monitor } from 'lucide-react';

type Theme = 'light' | 'dark' | 'system';
const STORAGE_KEY = 'eyeshots-theme';

function apply(theme: Theme) {
  const dark = theme === 'dark' || (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.classList.toggle('dark', dark);
  document.documentElement.style.colorScheme = dark ? 'dark' : 'light';
}

/** Inline script placed in <head> to set the theme before first paint (no flash). */
export const themeInitScript = `(()=>{try{var t=localStorage.getItem('${STORAGE_KEY}')||'system';var d=t==='dark'||(t==='system'&&matchMedia('(prefers-color-scheme: dark)').matches);var e=document.documentElement;e.classList.toggle('dark',d);e.style.colorScheme=d?'dark':'light'}catch(_){}})()`;

export function ThemeToggle({ className = '' }: { className?: string }) {
  const [theme, setTheme] = useState<Theme>('system');

  useEffect(() => {
    let stored: Theme = 'system';
    try {
      stored = (localStorage.getItem(STORAGE_KEY) as Theme) || 'system';
    } catch {}
    setTheme(stored);
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => {
      let current: Theme = 'system';
      try { current = (localStorage.getItem(STORAGE_KEY) as Theme) || 'system'; } catch {}
      if (current === 'system') apply('system');
    };
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  const cycle = () => {
    const next: Theme = theme === 'light' ? 'dark' : theme === 'dark' ? 'system' : 'light';
    setTheme(next);
    try { localStorage.setItem(STORAGE_KEY, next); } catch {}
    apply(next);
  };

  const Icon = theme === 'light' ? Sun : theme === 'dark' ? Moon : Monitor;
  const label = theme === 'light' ? 'Light theme' : theme === 'dark' ? 'Dark theme' : 'System theme';

  return (
    <button
      type="button"
      onClick={cycle}
      title={`${label} — click to switch`}
      aria-label={`${label}. Click to switch theme.`}
      className={`inline-flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-white/5 dark:hover:text-white ${className}`}
    >
      <Icon className="h-[18px] w-[18px]" />
    </button>
  );
}
