import React from 'react';
import {
  BookOpen, Combine, Crop, FileArchive, FileCheck2, FileCode2, FilePenLine, FileText, FileType2,
  FolderKanban, GitCompareArrows, Hash, ImagePlus, Images, Languages, Lock, LockOpen, PenTool,
  Presentation, Receipt, RotateCw, ScanText, Sheet, Sparkles, Split, Stamp, Trash2, Wrench, FileQuestion,
  type LucideIcon,
} from 'lucide-react';
import type { PdfTool } from '@/lib/tools-data';

const ICONS: Record<string, LucideIcon> = {
  BookOpen, Combine, Crop, FileArchive, FileCheck2, FileCode2, FilePenLine, FileText, FileType2,
  FolderKanban, GitCompareArrows, Hash, ImagePlus, Images, Languages, Lock, LockOpen, PenTool,
  Presentation, Receipt, RotateCw, ScanText, Sheet, Sparkles, Split, Stamp, Trash2, Wrench,
};

/** Static class map so Tailwind can see every class at build time. */
const TILE: Record<PdfTool['color'], string> = {
  emerald: 'bg-emerald-50 text-emerald-600 ring-emerald-600/10 dark:bg-emerald-500/10 dark:text-emerald-400 dark:ring-emerald-400/20',
  blue: 'bg-blue-50 text-blue-600 ring-blue-600/10 dark:bg-blue-500/10 dark:text-blue-400 dark:ring-blue-400/20',
  violet: 'bg-violet-50 text-violet-600 ring-violet-600/10 dark:bg-violet-500/10 dark:text-violet-400 dark:ring-violet-400/20',
  amber: 'bg-amber-50 text-amber-600 ring-amber-600/10 dark:bg-amber-500/10 dark:text-amber-400 dark:ring-amber-400/20',
  rose: 'bg-rose-50 text-rose-600 ring-rose-600/10 dark:bg-rose-500/10 dark:text-rose-400 dark:ring-rose-400/20',
  sky: 'bg-sky-50 text-sky-600 ring-sky-600/10 dark:bg-sky-500/10 dark:text-sky-400 dark:ring-sky-400/20',
  slate: 'bg-slate-100 text-slate-700 ring-slate-700/10 dark:bg-slate-500/10 dark:text-slate-300 dark:ring-slate-400/20',
  teal: 'bg-teal-50 text-teal-600 ring-teal-600/10 dark:bg-teal-500/10 dark:text-teal-400 dark:ring-teal-400/20',
  orange: 'bg-orange-50 text-orange-600 ring-orange-600/10 dark:bg-orange-500/10 dark:text-orange-400 dark:ring-orange-400/20',
};

export function ToolIcon({
  tool,
  size = 'md',
  className = '',
}: {
  tool: Pick<PdfTool, 'iconName' | 'color'>;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}) {
  const Icon = ICONS[tool.iconName] ?? FileQuestion;
  const box = size === 'sm' ? 'h-8 w-8 rounded-lg' : size === 'lg' ? 'h-14 w-14 rounded-2xl' : 'h-10 w-10 rounded-xl';
  const icon = size === 'sm' ? 'h-4 w-4' : size === 'lg' ? 'h-7 w-7' : 'h-5 w-5';
  return (
    <span className={`inline-flex shrink-0 items-center justify-center ring-1 ring-inset ${box} ${TILE[tool.color]} ${className}`}>
      <Icon className={icon} aria-hidden="true" />
    </span>
  );
}
