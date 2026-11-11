import React from 'react';

/** EyeShots wordmark: an aperture-style "eye" glyph + name. */
export function Logo({ showText = true }: { showText?: boolean }) {
  return (
    <span className="flex items-center gap-2">
      <span className="relative flex h-8 w-8 items-center justify-center rounded-[10px] bg-gradient-to-br from-brand-400 via-brand-600 to-brand-800 shadow-md shadow-brand-700/30">
        <svg viewBox="0 0 24 24" className="h-[18px] w-[18px] text-white" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M2 12s3.6-6.5 10-6.5S22 12 22 12s-3.6 6.5-10 6.5S2 12 2 12Z" />
          <circle cx="12" cy="12" r="3" fill="currentColor" stroke="none" />
        </svg>
      </span>
      {showText && (
        <span className="text-[17px] font-semibold tracking-tight text-slate-900 dark:text-white">
          EyeShots
        </span>
      )}
    </span>
  );
}
