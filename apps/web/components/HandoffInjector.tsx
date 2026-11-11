'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { hasPendingFiles, takePendingFiles } from '@/lib/file-handoff';
import { matchesAccept } from '@/lib/files/accept';

/**
 * Delivers files dropped on the home page to tool pages that use their own
 * <input type="file"> instead of <FileDropzone /> (which consumes the hand-off
 * itself). Runs after navigation; finds the first compatible file input and
 * feeds it the files exactly as if the user had picked them.
 */
export function HandoffInjector() {
  const pathname = usePathname();

  useEffect(() => {
    if (pathname === '/' || !hasPendingFiles()) return;
    let tries = 0;
    const timer = window.setInterval(() => {
      tries++;
      if (!hasPendingFiles() || tries > 20) return window.clearInterval(timer); // FileDropzone took it, or give up after ~2s
      const files = (takePendingFiles() ?? []);
      const inputs = Array.from(document.querySelectorAll<HTMLInputElement>('main input[type="file"]'));
      const target = inputs.find((i) => files.length > 0 && matchesAccept(files[0], i.accept || ''));
      if (!target) return window.clearInterval(timer);
      const dt = new DataTransfer();
      (target.multiple ? files : files.slice(0, 1)).forEach((f) => dt.items.add(f));
      target.files = dt.files;
      target.dispatchEvent(new Event('change', { bubbles: true }));
      window.clearInterval(timer);
    }, 100);
    return () => window.clearInterval(timer);
  }, [pathname]);

  return null;
}
