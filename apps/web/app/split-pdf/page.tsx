'use client';

import React, { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { 
  Split, 
  UploadCloud, 
  Download, 
  ShieldCheck, 
  Zap, 
  AlertCircle,
  Loader2,
  ChevronRight,
  Layers,
  LayoutGrid,
  Scissors,
  FileArchive,
  Check,
  CheckCircle2,
  Sparkles
} from 'lucide-react';
import { 
  extractPagesClient, 
  splitInHalfClient, 
  splitEveryNPagesClient, 
  parsePageRangeString, 
  downloadPdfBlob, 
  downloadZipBlob 
} from '@/lib/pdf/wasm-pipeline';
import { renderPageThumbnail } from '@/lib/pdf/thumbnail-generator';
import { PDFDocument } from 'pdf-lib';
import JSZip from 'jszip';
import * as pdfjsLib from 'pdfjs-dist';

if (typeof window !== 'undefined') {
  pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';
}

type SplitMode = 'visual' | 'ranges' | 'every-n' | 'half';

export default function SplitPdfPage() {
  const [file, setFile] = useState<File | null>(null);
  const [pageCount, setPageCount] = useState<number>(0);
  const [thumbnails, setThumbnails] = useState<Record<number, string>>({});
  const [splitMode, setSplitMode] = useState<SplitMode>('visual');

  // Mode params
  const [selectedVisualPages, setSelectedVisualPages] = useState<Set<number>>(new Set());
  const [rangeInput, setRangeInput] = useState<string>('1-2, 3-4');
  const [everyNCount, setEveryNCount] = useState<number>(1);

  const [isProcessing, setIsProcessing] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Render thumbnails
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
          const url = await renderPageThumbnail(doc, i, 170);
          setThumbnails((prev) => ({ ...prev, [i]: url }));
        } catch (e) {
          console.warn('Thumbnail err:', e);
        }
      }
    } catch (e) {
      console.error('Failed to load PDF thumbnails:', e);
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
      setSelectedVisualPages(new Set([0])); // default first page selected
      setRangeInput(count > 2 ? `1-2, 3-${count}` : '1, 2');
      setError(null);
      loadThumbnails(selected);
    } catch (err: any) {
      console.error(err);
      setError('Failed to read the selected PDF.');
    }
  };

  const toggleVisualPage = (zeroIdx: number) => {
    const next = new Set(selectedVisualPages);
    if (next.has(zeroIdx)) {
      if (next.size > 1) next.delete(zeroIdx);
    } else {
      next.add(zeroIdx);
    }
    setSelectedVisualPages(next);
  };

  const selectAllPages = () => {
    setSelectedVisualPages(new Set(Array.from({ length: pageCount }, (_, i) => i)));
  };

  const selectOddPages = () => {
    setSelectedVisualPages(new Set(Array.from({ length: pageCount }, (_, i) => i).filter((i) => i % 2 === 0)));
  };

  const selectEvenPages = () => {
    setSelectedVisualPages(new Set(Array.from({ length: pageCount }, (_, i) => i).filter((i) => i % 2 === 1)));
  };

  // Execute Split
  const handleSplit = async () => {
    if (!file || pageCount === 0) return;

    setIsProcessing(true);
    setStatusMessage('Splitting document locally in WebAssembly...');
    setError(null);

    try {
      const buffer = await file.arrayBuffer();
      const baseName = file.name.replace(/\.pdf$/i, '');

      // Mode 1: Visual Extraction
      if (splitMode === 'visual') {
        const indices = Array.from(selectedVisualPages).sort((a, b) => a - b);
        if (indices.length === 0) throw new Error('Please select at least one page to extract.');
        const resultBytes = await extractPagesClient(buffer, indices);
        downloadPdfBlob(resultBytes, `${baseName}-extracted-pages.pdf`);
        setStatusMessage('Extracted pages downloaded successfully!');
      }

      // Mode 2: Split in Half (50/50)
      else if (splitMode === 'half') {
        const { part1, part2 } = await splitInHalfClient(buffer);
        const zip = new JSZip();
        zip.file(`${baseName}-part1.pdf`, part1);
        zip.file(`${baseName}-part2.pdf`, part2);
        const zipBlob = await zip.generateAsync({ type: 'blob' });
        downloadZipBlob(zipBlob, `${baseName}-split-halves.zip`);
        setStatusMessage('Both halves generated and downloaded as ZIP!');
      }

      // Mode 3: Split Every N Pages
      else if (splitMode === 'every-n') {
        const parts = await splitEveryNPagesClient(buffer, everyNCount);
        if (parts.length === 1) {
          downloadPdfBlob(parts[0], `${baseName}-split.pdf`);
        } else {
          const zip = new JSZip();
          parts.forEach((bytes, idx) => {
            zip.file(`${baseName}-part-${idx + 1}.pdf`, bytes);
          });
          const zipBlob = await zip.generateAsync({ type: 'blob' });
          downloadZipBlob(zipBlob, `${baseName}-split-every-${everyNCount}.zip`);
        }
        setStatusMessage(`Split into ${parts.length} documents successfully!`);
      }

      // Mode 4: Split by Custom Ranges
      else if (splitMode === 'ranges') {
        const groups = rangeInput.split(',').map((s) => s.trim()).filter(Boolean);
        if (groups.length === 0) throw new Error('Please enter valid page ranges.');

        const zip = new JSZip();
        for (let i = 0; i < groups.length; i++) {
          const rangeStr = groups[i];
          const indices = parsePageRangeString(rangeStr, pageCount);
          if (indices.length > 0) {
            const extractedBytes = await extractPagesClient(buffer, indices);
            zip.file(`${baseName}-range-${rangeStr.replace(/[^0-9-]/g, '_')}.pdf`, extractedBytes);
          }
        }
        const zipBlob = await zip.generateAsync({ type: 'blob' });
        downloadZipBlob(zipBlob, `${baseName}-ranges.zip`);
        setStatusMessage('All range splits generated and packaged in ZIP!');
      }
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Failed to split PDF.');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8 select-none">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-xs text-slate-500">
        <Link href="/" className="hover:text-sky-600">Home</Link>
        <ChevronRight className="w-3.5 h-3.5" />
        <span className="text-slate-900 dark:text-white font-medium">Split PDF</span>
      </nav>

      {/* Header */}
      <div className="text-center space-y-3">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 text-xs font-semibold border border-emerald-200 dark:border-emerald-800/60">
          <Zap className="w-3.5 h-3.5 text-amber-500" />
          100% Client-Side WebAssembly &bull; Instant Extraction
        </div>
        <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900 dark:text-white">
          Split PDF by Pages or Ranges
        </h1>
        <p className="text-sm sm:text-base text-slate-600 dark:text-slate-400 max-w-lg mx-auto">
          Extract specific pages visually, split into equal halves, or carve into custom range packages.
        </p>
      </div>

      {!file ? (
        <div
          onClick={() => fileInputRef.current?.click()}
          className="group relative border-2 border-dashed border-sky-300 dark:border-sky-700/80 hover:border-sky-500 rounded-3xl p-10 sm:p-14 text-center cursor-pointer bg-white/70 dark:bg-slate-900/70 hover:bg-sky-50/40 dark:hover:bg-sky-950/20 transition-all shadow-sm"
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,application/pdf"
            onChange={handleFileSelect}
            className="hidden"
          />

          <div className="flex flex-col items-center gap-3">
            <div className="w-16 h-16 rounded-2xl bg-sky-50 dark:bg-sky-950 text-sky-600 dark:text-sky-400 flex items-center justify-center group-hover:scale-110 transition-transform shadow-md shadow-sky-500/10">
              <UploadCloud className="w-8 h-8" />
            </div>
            <div>
              <span className="text-base font-bold text-slate-800 dark:text-slate-100">
                Click to select a PDF document to split
              </span>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Zero server upload &bull; Confidential and processed locally in your browser
              </p>
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Smart Split Operations Toolbar */}
          <div className="p-4 sm:p-6 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-4 border-b border-slate-100 dark:border-slate-800">
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white truncate max-w-sm">
                  {file.name}
                </h3>
                <p className="text-xs text-slate-400">{pageCount} total pages</p>
              </div>

              {/* 4 Smart Split Mode Selector */}
              <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl text-xs font-semibold">
                <button
                  onClick={() => setSplitMode('visual')}
                  className={`px-3 py-1.5 rounded-lg transition-all ${
                    splitMode === 'visual'
                      ? 'bg-white dark:bg-slate-700 text-sky-700 dark:text-sky-300 shadow-sm'
                      : 'text-slate-600 dark:text-slate-400'
                  }`}
                >
                  Visual Extract
                </button>
                <button
                  onClick={() => setSplitMode('ranges')}
                  className={`px-3 py-1.5 rounded-lg transition-all ${
                    splitMode === 'ranges'
                      ? 'bg-white dark:bg-slate-700 text-sky-700 dark:text-sky-300 shadow-sm'
                      : 'text-slate-600 dark:text-slate-400'
                  }`}
                >
                  By Ranges
                </button>
                <button
                  onClick={() => setSplitMode('every-n')}
                  className={`px-3 py-1.5 rounded-lg transition-all ${
                    splitMode === 'every-n'
                      ? 'bg-white dark:bg-slate-700 text-sky-700 dark:text-sky-300 shadow-sm'
                      : 'text-slate-600 dark:text-slate-400'
                  }`}
                >
                  Every N Pages
                </button>
                <button
                  onClick={() => setSplitMode('half')}
                  className={`px-3 py-1.5 rounded-lg transition-all ${
                    splitMode === 'half'
                      ? 'bg-white dark:bg-slate-700 text-sky-700 dark:text-sky-300 shadow-sm'
                      : 'text-slate-600 dark:text-slate-400'
                  }`}
                >
                  Split in Half
                </button>
              </div>
            </div>

            {/* Mode-Specific Sub-toolbar */}
            {splitMode === 'visual' && (
              <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-2">
                  <span className="text-slate-500">Quick Select:</span>
                  <button
                    onClick={selectAllPages}
                    className="px-2.5 py-1 rounded-lg border bg-slate-50 hover:bg-slate-100 font-medium"
                  >
                    All Pages
                  </button>
                  <button
                    onClick={selectOddPages}
                    className="px-2.5 py-1 rounded-lg border bg-slate-50 hover:bg-slate-100 font-medium"
                  >
                    Odd Pages
                  </button>
                  <button
                    onClick={selectEvenPages}
                    className="px-2.5 py-1 rounded-lg border bg-slate-50 hover:bg-slate-100 font-medium"
                  >
                    Even Pages
                  </button>
                </div>
                <span className="text-sky-600 font-semibold">
                  {selectedVisualPages.size} of {pageCount} pages selected for extraction
                </span>
              </div>
            )}

            {splitMode === 'ranges' && (
              <div className="space-y-2 text-xs">
                <label className="font-semibold text-slate-700 dark:text-slate-300">
                  Page Ranges (comma-separated, e.g. 1-2, 3-4, 5-8):
                </label>
                <input
                  type="text"
                  value={rangeInput}
                  onChange={(e) => setRangeInput(e.target.value)}
                  placeholder="e.g. 1-2, 3-5, 6-10"
                  className="w-full px-3 py-2 border rounded-xl font-mono text-sm focus:outline-none focus:border-sky-500"
                />
                <p className="text-[11px] text-slate-400">
                  Each range will be saved as a separate PDF inside a downloaded ZIP archive.
                </p>
              </div>
            )}

            {splitMode === 'every-n' && (
              <div className="space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-slate-700 dark:text-slate-300">
                    Split into chunks of every:
                  </span>
                  <span className="font-bold text-sky-600 text-sm">
                    {everyNCount} {everyNCount === 1 ? 'page' : 'pages'} (yields {Math.ceil(pageCount / everyNCount)} PDFs)
                  </span>
                </div>
                <input
                  type="range"
                  min="1"
                  max={Math.max(1, pageCount - 1)}
                  value={everyNCount}
                  onChange={(e) => setEveryNCount(parseInt(e.target.value, 10))}
                  className="w-full accent-sky-600"
                />
              </div>
            )}

            {splitMode === 'half' && (
              <div className="p-3 bg-sky-50 dark:bg-sky-950/40 rounded-xl text-xs text-sky-800 dark:text-sky-200 flex items-center justify-between">
                <span>
                  Splits into Part 1 (Pages 1 to {Math.ceil(pageCount / 2)}) and Part 2 (Pages {Math.ceil(pageCount / 2) + 1} to {pageCount}).
                </span>
                <span className="font-bold">2 files in ZIP</span>
              </div>
            )}
          </div>

          {/* Interactive Thumbnails Grid */}
          <div className="space-y-2">
            <div className="flex justify-between items-center text-xs text-slate-500 px-1">
              <span>Click on any page thumbnail to toggle selection for extraction.</span>
              <button
                onClick={() => { setFile(null); setThumbnails({}); }}
                className="text-red-500 hover:underline"
              >
                Change PDF
              </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3 max-h-[500px] overflow-y-auto p-3 bg-slate-100/50 dark:bg-slate-900/50 rounded-2xl border">
              {Array.from({ length: pageCount }).map((_, idx) => {
                const pageNum = idx + 1;
                const isSelected = selectedVisualPages.has(idx);

                return (
                  <div
                    key={pageNum}
                    onClick={() => {
                      if (splitMode === 'visual') toggleVisualPage(idx);
                    }}
                    className={`group relative bg-white dark:bg-slate-800 rounded-xl p-2 border transition-all flex flex-col items-center cursor-pointer ${
                      splitMode === 'visual' && isSelected
                        ? 'border-sky-500 ring-2 ring-sky-400 shadow-md'
                        : 'border-slate-200 dark:border-slate-700 hover:border-slate-400'
                    }`}
                  >
                    {/* Thumbnail View */}
                    <div className="relative w-full aspect-[3/4] bg-slate-50 dark:bg-slate-900 rounded overflow-hidden flex items-center justify-center">
                      {thumbnails[pageNum] ? (
                        <img
                          src={thumbnails[pageNum]}
                          alt={`Page ${pageNum}`}
                          className="w-full h-full object-contain"
                        />
                      ) : (
                        <div className="flex flex-col items-center text-slate-400 text-[10px]">
                          <Loader2 className="w-3.5 h-3.5 animate-spin mb-1 text-sky-500" />
                          <span>Loading...</span>
                        </div>
                      )}

                      {/* Selection Badge */}
                      {splitMode === 'visual' && isSelected && (
                        <div className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full bg-sky-600 text-white flex items-center justify-center text-xs shadow">
                          <Check className="w-3 h-3 stroke-[3]" />
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

          {/* Messages */}
          {error && (
            <div className="p-4 rounded-2xl bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-800/50 flex items-center gap-3 text-red-700 dark:text-red-300 text-xs">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {statusMessage && (
            <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800/50 flex items-center gap-3 text-emerald-700 dark:text-emerald-300 text-xs">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
              <span>{statusMessage}</span>
            </div>
          )}

          {/* Bottom Action Footer */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t border-slate-200 dark:border-slate-800">
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <ShieldCheck className="w-4 h-4 text-emerald-500" />
              <span>100% In-Browser &bull; Output files auto-downloaded directly to your device.</span>
            </div>

            <button
              onClick={handleSplit}
              disabled={isProcessing}
              className="w-full sm:w-auto px-8 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold text-sm shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Splitting PDF...</span>
                </>
              ) : (
                <>
                  <Download className="w-4 h-4" />
                  <span>
                    {splitMode === 'visual'
                      ? `Extract ${selectedVisualPages.size} Selected Pages`
                      : splitMode === 'half'
                      ? 'Split in Half & Download ZIP'
                      : splitMode === 'every-n'
                      ? `Split Every ${everyNCount} Pages & Download`
                      : 'Split by Ranges & Download ZIP'}
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
