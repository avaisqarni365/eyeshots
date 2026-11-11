'use client';

import React, { useState, useRef, useEffect, DragEvent, ChangeEvent } from 'react';
import { UploadCloud, ShieldCheck, AlertCircle, Laptop } from 'lucide-react';
import { takePendingFiles } from '@/lib/file-handoff';
import { matchesAccept, describeAccept } from '@/lib/files/accept';

export interface FileDropzoneProps {
  onFilesSelected?: (files: File[]) => void;
  onFileSelected?: (file: File) => void;
  /** Comma-separated list of extensions and/or MIME types, like an <input accept>. */
  accept?: string;
  multiple?: boolean;
  title?: string;
  description?: string;
  badge?: string;
  compact?: boolean;
  className?: string;
  /** Kept for backwards compatibility; all variants now share the brand style. */
  variant?: 'emerald' | 'blue' | 'indigo' | 'amber';
  /** Per-file size limit in MB (free tier default: 100 MB). */
  maxSizeMb?: number;
  /** Auto-load files handed off from another page (e.g. dropped on the home page). */
  acceptHandoff?: boolean;
}

export const FileDropzone: React.FC<FileDropzoneProps> = ({
  onFilesSelected,
  onFileSelected,
  accept = '.pdf,application/pdf',
  multiple = false,
  title,
  description = 'Your files are processed on your device whenever possible.',
  badge,
  compact = false,
  className = '',
  maxSizeMb = 100,
  acceptHandoff = true,
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const dragCounterRef = useRef(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const processFiles = (rawFiles: FileList | File[]) => {
    const fileList = Array.from(rawFiles);
    setErrorMessage(null);

    const valid = fileList.filter((f) => matchesAccept(f, accept));
    if (valid.length === 0) {
      setErrorMessage(`Unsupported file type. Please choose ${describeAccept(accept)} files.`);
      return;
    }
    const tooBig = valid.filter((f) => f.size > maxSizeMb * 1024 * 1024);
    const ok = valid.filter((f) => f.size <= maxSizeMb * 1024 * 1024);
    if (ok.length === 0) {
      setErrorMessage(`File is larger than ${maxSizeMb} MB. Upgrade to Pro for files up to 1 GB.`);
      return;
    }
    if (tooBig.length > 0 || valid.length < fileList.length) {
      setErrorMessage(`${fileList.length - ok.length} file(s) skipped (unsupported type or over ${maxSizeMb} MB).`);
    }

    const selected = multiple ? ok : [ok[0]];
    onFileSelected?.(selected[0]);
    onFilesSelected?.(selected);
  };

  // Pick up files dropped on another page (in-memory hand-off, never persisted).
  useEffect(() => {
    if (!acceptHandoff) return;
    const handed = takePendingFiles();
    if (handed && handed.length) processFiles(handed);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleDragEnter = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current += 1;
    if (e.dataTransfer?.items && e.dataTransfer.items.length > 0) setIsDragging(true);
  };
  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
  };
  const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current -= 1;
    if (dragCounterRef.current === 0) setIsDragging(false);
  };
  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    dragCounterRef.current = 0;
    if (e.dataTransfer?.files && e.dataTransfer.files.length > 0) processFiles(e.dataTransfer.files);
  };
  const handleFileInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      processFiles(e.target.files);
      e.target.value = '';
    }
  };

  const isPdfOnly = accept.replace(/\s/g, '') === '.pdf,application/pdf';
  const heading =
    title ?? (multiple ? `Drop ${isPdfOnly ? 'PDF files' : 'files'} here` : `Drop a ${isPdfOnly ? 'PDF' : 'file'} here`);

  return (
    <div className={`w-full ${className}`}>
      <div
        onClick={() => fileInputRef.current?.click()}
        onDragEnter={handleDragEnter}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        role="button"
        tabIndex={0}
        aria-label={heading}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            fileInputRef.current?.click();
          }
        }}
        className={`group relative cursor-pointer select-none overflow-hidden rounded-3xl border-2 border-dashed transition-all duration-200 focus:outline-none focus-visible:ring-4 focus-visible:ring-brand-500/30 ${
          compact ? 'p-6 sm:p-8' : 'p-10 sm:p-14'
        } ${
          isDragging
            ? 'scale-[1.01] border-brand-500 bg-brand-50/70 ring-4 ring-brand-500/15 dark:bg-brand-500/10'
            : 'border-slate-300 bg-white/70 hover:border-brand-400 hover:bg-brand-50/30 dark:border-white/15 dark:bg-white/[0.02] dark:hover:border-brand-400/60 dark:hover:bg-brand-500/5'
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept={accept}
          multiple={multiple}
          onChange={handleFileInputChange}
          className="hidden"
        />

        <div className="relative flex flex-col items-center space-y-4 text-center">
          <div
            className={`flex items-center justify-center rounded-2xl bg-gradient-to-br from-brand-500 to-brand-700 text-white shadow-lg shadow-brand-600/25 transition-transform duration-200 ${
              compact ? 'h-12 w-12' : 'h-16 w-16'
            } ${isDragging ? 'scale-110' : 'group-hover:-translate-y-0.5'}`}
          >
            <UploadCloud className={compact ? 'h-6 w-6' : 'h-8 w-8'} />
          </div>

          <div className="space-y-1.5">
            <h3 className={`font-semibold tracking-tight text-slate-900 dark:text-white ${compact ? 'text-base' : 'text-lg sm:text-xl'}`}>
              {isDragging ? 'Release to upload' : heading}
            </h3>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              or{' '}
              <span className="font-semibold text-brand-600 underline-offset-4 group-hover:underline dark:text-brand-400">
                browse your device
              </span>
              {' '}· up to {maxSizeMb} MB
            </p>
            {description && !compact && (
              <p className="mx-auto max-w-md pt-1 text-xs text-slate-400 dark:text-slate-500">{description}</p>
            )}
          </div>

          <div className="flex flex-wrap items-center justify-center gap-2">
            {badge && (
              <span className="inline-flex items-center gap-1 rounded-full border border-brand-200 bg-brand-50 px-2.5 py-1 text-[11px] font-medium text-brand-700 dark:border-brand-500/20 dark:bg-brand-500/10 dark:text-brand-300">
                <Laptop className="h-3 w-3" />
                {badge.replace(/^[^\w]+/, '')}
              </span>
            )}
            <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-medium text-slate-500 dark:border-white/10 dark:bg-white/5 dark:text-slate-400">
              <ShieldCheck className="h-3 w-3 text-brand-500" />
              Zero retention
            </span>
          </div>

          {errorMessage && (
            <div role="alert" className="mt-1 flex items-center gap-1.5 rounded-xl border border-red-200 bg-red-50 px-3 py-1.5 text-xs text-red-600 animate-fade-in dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-400">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
