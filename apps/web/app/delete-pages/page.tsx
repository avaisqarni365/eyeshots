'use client';

import React, { useState, useRef } from 'react';
import Link from 'next/link';
import { 
  Trash2, 
  UploadCloud, 
  Download, 
  ShieldCheck, 
  Zap, 
  AlertCircle, 
  Loader2, 
  ChevronRight, 
  FileCheck,
  Check,
  RotateCw,
  RefreshCw,
  CheckSquare,
  Square
} from 'lucide-react';
import { deletePagesClient, downloadPdfBlob } from '@/lib/pdf/wasm-pipeline';
import { renderPageThumbnail } from '@/lib/pdf/thumbnail-generator';
import { PDFDocument } from 'pdf-lib';
import * as pdfjsLib from 'pdfjs-dist';

if (typeof window !== 'undefined') {
  pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';
}

export default function DeletePagesPage() {
  const [file, setFile] = useState<File | null>(null);
  const [pageCount, setPageCount] = useState<number>(0);
  const [thumbnails, setThumbnails] = useState<Record<number, string>>({});
  const [selectedForDeletion, setSelectedForDeletion] = useState<Set<number>>(new Set());
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadThumbnails = async (f: File) => {
    try {
      const buffer = await f.arrayBuffer();
      const loadingTask = pdfjsLib.getDocument({
        data: new Uint8Array(buffer).slice(),
        cMapUrl: '/pdfjs/cmaps/',
        cMapPacked: true,
      });
      const doc = await loadingTask.promise;
      const total = doc.numPages;

      for (let i = 1; i <= total; i++) {
        try {
          const url = await renderPageThumbnail(doc, i, 180);
          setThumbnails((prev) => ({ ...prev, [i]: url }));
        } catch (e) {
          console.warn('Thumb err:', e);
        }
      }
    } catch (e) {
      console.error('Failed to load thumbnails:', e);
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const selected = e.target.files[0];

    if (!selected.name.toLowerCase().endsWith('.pdf')) {
      setError('Please select a valid PDF file.');
      return;
    }

    try {
      const buffer = await selected.arrayBuffer();
      const doc = await PDFDocument.load(buffer, { ignoreEncryption: true });
      const count = doc.getPageCount();

      setFile(selected);
      setPageCount(count);
      setThumbnails({});
      setSelectedForDeletion(new Set());
      setError(null);
      loadThumbnails(selected);
    } catch (err: any) {
      console.error(err);
      setError('Failed to read the selected PDF.');
    }
  };

  const togglePageDeletion = (zeroIdx: number) => {
    const next = new Set(selectedForDeletion);
    if (next.has(zeroIdx)) {
      next.delete(zeroIdx);
      setError(null);
    } else {
      if (next.size + 1 >= pageCount) {
        setError('You cannot delete all pages of the document.');
        return;
      }
      next.add(zeroIdx);
      setError(null);
    }
    setSelectedForDeletion(next);
  };

  // Smart selection helpers
  const selectOddPages = () => {
    const odds = Array.from({ length: pageCount }, (_, i) => i).filter((i) => i % 2 === 0);
    if (odds.length >= pageCount) {
      setError('Cannot delete all pages.');
      return;
    }
    setSelectedForDeletion(new Set(odds));
    setError(null);
  };

  const selectEvenPages = () => {
    const evens = Array.from({ length: pageCount }, (_, i) => i).filter((i) => i % 2 === 1);
    if (evens.length >= pageCount) {
      setError('Cannot delete all pages.');
      return;
    }
    setSelectedForDeletion(new Set(evens));
    setError(null);
  };

  const invertSelection = () => {
    const inverted = new Set<number>();
    for (let i = 0; i < pageCount; i++) {
      if (!selectedForDeletion.has(i)) inverted.add(i);
    }
    if (inverted.size >= pageCount) {
      setError('Cannot delete all pages.');
      return;
    }
    setSelectedForDeletion(inverted);
    setError(null);
  };

  const handleDelete = async () => {
    if (!file || selectedForDeletion.size === 0) {
      setError('Please click on at least one page to delete.');
      return;
    }

    setIsProcessing(true);
    setError(null);

    try {
      const buffer = await file.arrayBuffer();
      const indicesToDelete = Array.from(selectedForDeletion);
      const remainingBytes = await deletePagesClient(buffer, indicesToDelete);

      const newName = file.name.replace(/\.pdf$/i, '-pages-removed.pdf');
      downloadPdfBlob(remainingBytes, newName);
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Failed to delete pages.');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8 select-none">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-xs text-slate-500">
        <Link href="/" className="hover:text-red-600">Home</Link>
        <ChevronRight className="w-3.5 h-3.5" />
        <span className="text-slate-900 dark:text-white font-medium">Delete Pages</span>
      </nav>

      {/* Header */}
      <div className="text-center space-y-3">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-red-50 dark:bg-red-950/60 text-red-700 dark:text-red-300 text-xs font-semibold border border-red-200 dark:border-red-800/60">
          <Zap className="w-3.5 h-3.5 text-amber-500" />
          100% Client-Side WebAssembly &bull; Zero Server Retention
        </div>
        <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900 dark:text-white">
          Delete PDF Pages Online
        </h1>
        <p className="text-sm sm:text-base text-slate-600 dark:text-slate-400 max-w-lg mx-auto">
          Visually select pages to remove from your document. Simply click any thumbnail to toggle deletion.
        </p>
      </div>

      {!file ? (
        <div
          onClick={() => fileInputRef.current?.click()}
          className="group relative border-2 border-dashed border-red-300 dark:border-red-700/80 hover:border-red-500 rounded-3xl p-10 sm:p-14 text-center cursor-pointer bg-white/70 dark:bg-slate-900/70 hover:bg-red-50/40 dark:hover:bg-red-950/20 transition-all shadow-sm"
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,application/pdf"
            onChange={handleFileSelect}
            className="hidden"
          />

          <div className="flex flex-col items-center gap-3">
            <div className="w-16 h-16 rounded-2xl bg-red-50 dark:bg-red-950 text-red-600 dark:text-red-400 flex items-center justify-center group-hover:scale-110 transition-transform shadow-md shadow-red-500/10">
              <UploadCloud className="w-8 h-8" />
            </div>
            <div>
              <span className="text-base font-bold text-slate-800 dark:text-slate-100">
                Click to select a PDF document
              </span>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Your file is never uploaded &bull; All page removals happen in your browser
              </p>
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Smart Selection Toolbar */}
          <div className="flex flex-wrap items-center justify-between gap-4 p-4 sm:p-5 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
            <div className="flex items-center gap-3">
              <FileCheck className="w-6 h-6 text-red-600" />
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white truncate max-w-xs sm:max-w-md">
                  {file.name}
                </h3>
                <p className="text-xs text-slate-400">
                  {pageCount} total pages &bull;{' '}
                  <span className="text-red-600 font-bold">{selectedForDeletion.size} marked for removal</span>{' '}
                  ({pageCount - selectedForDeletion.size} pages will remain)
                </p>
              </div>
            </div>

            {/* Smart Filters */}
            <div className="flex items-center gap-1.5 flex-wrap text-xs">
              <span className="text-slate-400 font-medium mr-1">Select:</span>
              <button
                onClick={selectOddPages}
                className="px-2.5 py-1.5 rounded-lg border bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 font-semibold text-slate-700 dark:text-slate-300"
              >
                Odd Pages
              </button>
              <button
                onClick={selectEvenPages}
                className="px-2.5 py-1.5 rounded-lg border bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 font-semibold text-slate-700 dark:text-slate-300"
              >
                Even Pages
              </button>
              <button
                onClick={invertSelection}
                className="px-2.5 py-1.5 rounded-lg border bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 font-semibold text-slate-700 dark:text-slate-300"
              >
                Invert
              </button>
              {selectedForDeletion.size > 0 && (
                <button
                  onClick={() => setSelectedForDeletion(new Set())}
                  className="px-2.5 py-1.5 rounded-lg text-slate-500 hover:text-slate-700 font-semibold"
                >
                  Clear Selection
                </button>
              )}
              <button
                onClick={() => { setFile(null); setThumbnails({}); setSelectedForDeletion(new Set()); }}
                className="px-2.5 py-1.5 text-red-500 hover:underline"
              >
                Change PDF
              </button>
            </div>
          </div>

          {/* Interactive Thumbnails Grid */}
          <div className="space-y-2">
            <div className="flex justify-between items-center text-xs text-slate-500 px-1">
              <span>Click on any thumbnail to mark or unmark it for deletion.</span>
              <span className="text-red-600 font-bold">
                {selectedForDeletion.size} marked
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3.5 max-h-[550px] overflow-y-auto p-3 bg-slate-100/50 dark:bg-slate-900/50 rounded-2xl border">
              {Array.from({ length: pageCount }).map((_, idx) => {
                const pageNum = idx + 1;
                const isMarked = selectedForDeletion.has(idx);

                return (
                  <div
                    key={pageNum}
                    onClick={() => togglePageDeletion(idx)}
                    className={`group relative bg-white dark:bg-slate-800 rounded-xl p-2 border transition-all flex flex-col items-center cursor-pointer select-none ${
                      isMarked
                        ? 'border-red-500 ring-2 ring-red-400 shadow-md bg-red-50/50 dark:bg-red-950/20'
                        : 'border-slate-200 dark:border-slate-700 hover:border-slate-400 shadow-sm'
                    }`}
                  >
                    {/* Thumbnail View */}
                    <div className="relative w-full aspect-[3/4] bg-slate-50 dark:bg-slate-900 rounded overflow-hidden flex items-center justify-center">
                      {thumbnails[pageNum] ? (
                        <img
                          src={thumbnails[pageNum]}
                          alt={`Page ${pageNum}`}
                          className={`w-full h-full object-contain transition-all ${
                            isMarked ? 'opacity-30 blur-[0.5px] scale-95' : 'opacity-100'
                          }`}
                        />
                      ) : (
                        <div className="flex flex-col items-center text-slate-400 text-[10px]">
                          <Loader2 className="w-3.5 h-3.5 animate-spin mb-1 text-red-500" />
                          <span>Loading...</span>
                        </div>
                      )}

                      {/* Deletion Overlay Banner */}
                      {isMarked && (
                        <div className="absolute inset-0 bg-red-600/40 backdrop-blur-[1px] flex flex-col items-center justify-center text-white animate-fade-in">
                          <div className="w-8 h-8 rounded-full bg-red-600 flex items-center justify-center shadow-lg">
                            <Trash2 className="w-4 h-4 text-white" />
                          </div>
                          <span className="text-[10px] font-bold uppercase tracking-wider mt-1 drop-shadow">
                            Delete
                          </span>
                        </div>
                      )}

                      {/* Hover hint */}
                      {!isMarked && (
                        <div className="absolute inset-0 bg-black/10 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                          <span className="px-2 py-1 rounded bg-black/75 text-white text-[10px] font-bold">
                            Click to delete
                          </span>
                        </div>
                      )}
                    </div>

                    <div className="w-full text-center mt-1.5 text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                      Page {pageNum}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Error Message */}
          {error && (
            <div className="p-4 rounded-2xl bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-800/50 flex items-center gap-3 text-red-700 dark:text-red-300 text-xs">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Bottom Action Footer */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t border-slate-200 dark:border-slate-800">
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <ShieldCheck className="w-4 h-4 text-emerald-500" />
              <span>100% In-Browser &bull; Original PDF never leaves your device.</span>
            </div>

            <button
              onClick={handleDelete}
              disabled={isProcessing || selectedForDeletion.size === 0}
              className="w-full sm:w-auto px-8 py-3 rounded-xl bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white font-bold text-sm shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Deleting pages...</span>
                </>
              ) : (
                <>
                  <Trash2 className="w-4 h-4" />
                  <span>
                    Apply & Remove {selectedForDeletion.size} {selectedForDeletion.size === 1 ? 'Page' : 'Pages'}
                  </span>
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
