'use client';

import React, { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { X, FileText, ArrowRight } from 'lucide-react';
import { FileDropzone } from '@/components/FileDropzone';
import { setPendingFiles } from '@/lib/file-handoff';
import { getTool, type PdfTool } from '@/lib/tools-data';
import { ToolIcon } from '@/components/ui/ToolIcon';

const PDF_ACTIONS = ['edit-pdf', 'compress-pdf', 'merge-pdf', 'split-pdf', 'fill-and-sign', 'pdf-to-word', 'ocr-pdf', 'pdf-to-jpg', 'compare-pdf', 'protect-pdf'];
const IMAGE_ACTIONS = ['jpg-to-pdf'];

function actionsFor(file: File): PdfTool[] {
  const name = file.name.toLowerCase();
  let ids: string[] = PDF_ACTIONS;
  if (/\.(jpe?g|png|webp|gif|bmp)$/.test(name) || file.type.startsWith('image/')) ids = IMAGE_ACTIONS;
  else if (/\.(docx?|odt|rtf)$/.test(name)) ids = ['word-to-pdf'];
  else if (/\.(xlsx?|ods|csv)$/.test(name)) ids = ['excel-to-pdf'];
  else if (/\.(pptx?|odp)$/.test(name)) ids = ['powerpoint-to-pdf'];
  return ids.map((id) => getTool(id)).filter((t): t is PdfTool => Boolean(t));
}

function formatSize(bytes: number) {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function HeroDropzone() {
  const router = useRouter();
  const [files, setFiles] = useState<File[] | null>(null);
  const actions = useMemo(() => (files ? actionsFor(files[0]) : []), [files]);

  const choose = (tool: PdfTool) => {
    if (!files) return;
    setPendingFiles(files);
    router.push(tool.path);
  };

  return (
    <>
      <FileDropzone
        multiple
        acceptHandoff={false}
        accept=".pdf,application/pdf,.jpg,.jpeg,.png,.webp,.docx,.doc,.odt,.rtf,.xlsx,.xls,.ods,.pptx,.ppt,.odp"
        onFilesSelected={(f) => {
          // Images can be combined; everything else is handled one file at a time.
          const first = f[0];
          const isImage = first.type.startsWith('image/');
          setFiles(isImage ? f.filter((x) => x.type.startsWith('image/')) : f.filter((x) => x.name.toLowerCase().endsWith('.pdf')).length > 1 ? f : [first]);
        }}
        title="Drop your files here"
        description="PDF, Word, Excel, PowerPoint or images. Most tools run entirely in your browser."
      />

      {files && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-sm animate-fade-in" onMouseDown={() => setFiles(null)}>
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="handoff-title"
            className="w-full max-w-lg rounded-3xl border border-slate-200 bg-white p-6 text-left shadow-2xl dark:border-white/10 dark:bg-slate-900 sm:p-7"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex min-w-0 items-center gap-3">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600 dark:bg-brand-500/10 dark:text-brand-400">
                  <FileText className="h-5 w-5" />
                </span>
                <div className="min-w-0">
                  <h3 id="handoff-title" className="truncate text-sm font-semibold text-slate-900 dark:text-white">
                    {files.length > 1 ? `${files.length} files selected` : files[0].name}
                  </h3>
                  <p className="text-xs text-slate-500">
                    {formatSize(files.reduce((s, f) => s + f.size, 0))} · What would you like to do?
                  </p>
                </div>
              </div>
              <button
                onClick={() => setFiles(null)}
                aria-label="Close"
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-white/5"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mt-5 grid grid-cols-1 gap-2 sm:grid-cols-2">
              {actions.map((tool) => (
                <button
                  key={tool.id}
                  onClick={() => choose(tool)}
                  className="group flex items-center gap-3 rounded-xl border border-slate-200 p-3 text-left transition hover:border-brand-400 hover:bg-brand-50/50 dark:border-white/10 dark:hover:border-brand-500/50 dark:hover:bg-brand-500/5"
                >
                  <ToolIcon tool={tool} size="sm" />
                  <span className="min-w-0 flex-1 text-sm font-medium text-slate-800 dark:text-slate-100">{tool.name}</span>
                  <ArrowRight className="h-4 w-4 text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-brand-500" />
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
