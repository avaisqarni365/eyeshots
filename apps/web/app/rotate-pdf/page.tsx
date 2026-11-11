'use client';

import React, { useState, useRef } from 'react';
import Link from 'next/link';
import { 
  RotateCw, 
  RotateCcw, 
  UploadCloud, 
  Download, 
  ShieldCheck, 
  Zap, 
  AlertCircle,
  Loader2,
  ChevronRight,
  FileCheck,
  CheckCircle2,
  RefreshCw
} from 'lucide-react';
import { rotatePagesClient, downloadPdfBlob } from '@/lib/pdf/wasm-pipeline';
import { renderPageThumbnail } from '@/lib/pdf/thumbnail-generator';
import { PDFDocument } from 'pdf-lib';
import * as pdfjsLib from 'pdfjs-dist';

if (typeof window !== 'undefined') {
  pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';
}

interface PageMeta {
  pageNum: number;
  width: number;
  height: number;
  isLandscape: boolean;
}

export default function RotatePdfPage() {
  const [file, setFile] = useState<File | null>(null);
  const [pageCount, setPageCount] = useState<number>(0);
  const [thumbnails, setThumbnails] = useState<Record<number, string>>({});
  const [pageMetas, setPageMetas] = useState<Record<number, PageMeta>>({});
  const [pageRotations, setPageRotations] = useState<Record<number, number>>({});
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

      const metas: Record<number, PageMeta> = {};

      for (let i = 1; i <= total; i++) {
        try {
          const page = await doc.getPage(i);
          const vp = page.getViewport({ scale: 1 });
          metas[i] = {
            pageNum: i,
            width: vp.width,
            height: vp.height,
            isLandscape: vp.width > vp.height,
          };

          const url = await renderPageThumbnail(doc, i, 180);
          setThumbnails((prev) => ({ ...prev, [i]: url }));
        } catch (e) {
          console.warn('Thumb err:', e);
        }
      }

      setPageMetas(metas);
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
      setPageRotations({});
      setThumbnails({});
      setError(null);
      loadThumbnails(selected);
    } catch (err: any) {
      console.error(err);
      setError('Failed to read the selected PDF.');
    }
  };

  // Smart global rotation operations
  const rotateAll = (degreesToAdd: number) => {
    const updated: Record<number, number> = {};
    for (let i = 0; i < pageCount; i++) {
      const current = pageRotations[i] || 0;
      updated[i] = (((current + degreesToAdd) % 360) + 360) % 360;
    }
    setPageRotations(updated);
  };

  const rotateFiltered = (filterType: 'odd' | 'even' | 'portrait' | 'landscape', degreesToAdd: number) => {
    const updated = { ...pageRotations };
    for (let i = 0; i < pageCount; i++) {
      const pageNum = i + 1;
      const meta = pageMetas[pageNum];
      let matches = false;

      if (filterType === 'odd' && pageNum % 2 === 1) matches = true;
      if (filterType === 'even' && pageNum % 2 === 0) matches = true;
      if (filterType === 'portrait' && meta && !meta.isLandscape) matches = true;
      if (filterType === 'landscape' && meta && meta.isLandscape) matches = true;

      if (matches) {
        const current = updated[i] || 0;
        updated[i] = (((current + degreesToAdd) % 360) + 360) % 360;
      }
    }
    setPageRotations(updated);
  };

  const rotateSinglePage = (pageIdx: number, degreesToAdd: number) => {
    const current = pageRotations[pageIdx] || 0;
    setPageRotations((prev) => ({
      ...prev,
      [pageIdx]: (((current + degreesToAdd) % 360) + 360) % 360,
    }));
  };

  const resetRotations = () => {
    setPageRotations({});
  };

  const handleSaveAndDownload = async () => {
    if (!file) return;

    setIsProcessing(true);
    setError(null);

    try {
      const buffer = await file.arrayBuffer();
      const rotatedBytes = await rotatePagesClient(buffer, pageRotations);

      const newName = file.name.replace(/\.pdf$/i, '-rotated.pdf');
      downloadPdfBlob(rotatedBytes, newName);
    } catch (err: any) {
      console.error(err);
      setError('Failed to rotate and download PDF.');
    } finally {
      setIsProcessing(false);
    }
  };

  const totalRotatedCount = Object.values(pageRotations).filter((deg) => deg !== 0).length;

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8 select-none">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-xs text-slate-500">
        <Link href="/" className="hover:text-sky-600">Home</Link>
        <ChevronRight className="w-3.5 h-3.5" />
        <span className="text-slate-900 dark:text-white font-medium">Rotate PDF</span>
      </nav>

      {/* Header */}
      <div className="text-center space-y-3">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-sky-50 dark:bg-sky-950/60 text-sky-700 dark:text-sky-300 text-xs font-semibold border border-sky-200 dark:border-sky-800/60">
          <Zap className="w-3.5 h-3.5 text-amber-500" />
          100% Client-Side WebAssembly &bull; Real-Time Live Preview
        </div>
        <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900 dark:text-white">
          Rotate PDF Pages
        </h1>
        <p className="text-sm sm:text-base text-slate-600 dark:text-slate-400 max-w-lg mx-auto">
          Rotate all pages or individual pages clockwise or counter-clockwise with immediate visual feedback.
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
                Click to select a PDF document to rotate
              </span>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Zero server upload &bull; Fast and private browser-only rotation
              </p>
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Smart Global Rotation Toolbar */}
          <div className="flex flex-wrap items-center justify-between gap-4 p-4 sm:p-5 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
            <div className="flex items-center gap-3">
              <FileCheck className="w-6 h-6 text-sky-600" />
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white truncate max-w-xs sm:max-w-md">
                  {file.name}
                </h3>
                <p className="text-xs text-slate-400">
                  {pageCount} pages &bull;{' '}
                  <span className="text-sky-600 font-bold">{totalRotatedCount} pages modified</span>
                </p>
              </div>
            </div>

            {/* Smart Action Buttons */}
            <div className="flex items-center gap-2 flex-wrap text-xs">
              <button
                onClick={() => rotateAll(90)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 font-semibold text-slate-700 dark:text-slate-300"
                title="Rotate All Pages 90° Clockwise"
              >
                <RotateCw className="w-3.5 h-3.5 text-sky-600" />
                <span>Rotate All Right</span>
              </button>

              <button
                onClick={() => rotateAll(-90)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 font-semibold text-slate-700 dark:text-slate-300"
                title="Rotate All Pages 90° Counter-Clockwise"
              >
                <RotateCcw className="w-3.5 h-3.5 text-sky-600" />
                <span>Rotate All Left</span>
              </button>

              <button
                onClick={() => rotateAll(180)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 font-semibold text-slate-700 dark:text-slate-300"
                title="Rotate All Pages 180°"
              >
                <RefreshCw className="w-3.5 h-3.5 text-sky-600" />
                <span>Rotate All 180°</span>
              </button>

              {totalRotatedCount > 0 && (
                <button
                  onClick={resetRotations}
                  className="px-3 py-1.5 rounded-xl text-slate-500 hover:text-slate-700 font-semibold"
                >
                  Reset
                </button>
              )}

              <button
                onClick={() => { setFile(null); setThumbnails({}); setPageRotations({}); }}
                className="px-2.5 py-1.5 text-red-500 hover:underline"
              >
                Change PDF
              </button>
            </div>
          </div>

          {/* Smart Selective Rotation Sub-Toolbar */}
          <div className="flex flex-wrap items-center gap-2 p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200/60 dark:border-slate-800 text-xs">
            <span className="text-slate-500 font-bold mr-1">Rotate Selected:</span>
            <button
              onClick={() => rotateFiltered('odd', 90)}
              className="px-2.5 py-1 rounded-lg bg-white dark:bg-slate-700 border hover:bg-slate-50 font-medium"
            >
              Odd Pages +90°
            </button>
            <button
              onClick={() => rotateFiltered('even', 90)}
              className="px-2.5 py-1 rounded-lg bg-white dark:bg-slate-700 border hover:bg-slate-50 font-medium"
            >
              Even Pages +90°
            </button>
            <button
              onClick={() => rotateFiltered('landscape', 90)}
              className="px-2.5 py-1 rounded-lg bg-white dark:bg-slate-700 border hover:bg-slate-50 font-medium"
            >
              Only Landscape +90°
            </button>
            <button
              onClick={() => rotateFiltered('portrait', 90)}
              className="px-2.5 py-1 rounded-lg bg-white dark:bg-slate-700 border hover:bg-slate-50 font-medium"
            >
              Only Portrait +90°
            </button>
          </div>

          {/* Interactive Thumbnails Grid with Real-time CSS Rotation */}
          <div className="space-y-2">
            <div className="flex justify-between items-center text-xs text-slate-500 px-1">
              <span>Hover over any thumbnail to rotate that page individually.</span>
              <span className="text-sky-600 font-bold">
                {totalRotatedCount} pages changed
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3.5 max-h-[550px] overflow-y-auto p-3 bg-slate-100/50 dark:bg-slate-900/50 rounded-2xl border">
              {Array.from({ length: pageCount }).map((_, idx) => {
                const pageNum = idx + 1;
                const rot = pageRotations[idx] || 0;

                return (
                  <div
                    key={pageNum}
                    className={`group relative bg-white dark:bg-slate-800 rounded-xl p-2 border transition-all flex flex-col items-center shadow-sm hover:shadow-md ${
                      rot !== 0
                        ? 'border-sky-500 ring-2 ring-sky-400 bg-sky-50/20 dark:bg-sky-950/20'
                        : 'border-slate-200 dark:border-slate-700 hover:border-slate-400'
                    }`}
                  >
                    {/* Thumbnail View with Live CSS Rotation */}
                    <div className="relative w-full aspect-[3/4] bg-slate-50 dark:bg-slate-900 rounded overflow-hidden flex items-center justify-center">
                      {thumbnails[pageNum] ? (
                        <img
                          src={thumbnails[pageNum]}
                          alt={`Page ${pageNum}`}
                          className="w-full h-full object-contain transition-transform duration-300"
                          style={{ transform: `rotate(${rot}deg)` }}
                        />
                      ) : (
                        <div className="flex flex-col items-center text-slate-400 text-[10px]">
                          <Loader2 className="w-3.5 h-3.5 animate-spin mb-1 text-sky-500" />
                          <span>Loading...</span>
                        </div>
                      )}

                      {/* Rotated Angle Badge */}
                      {rot !== 0 && (
                        <div className="absolute top-1.5 right-1.5 px-1.5 py-0.5 rounded bg-sky-600 text-white font-bold text-[10px] shadow">
                          {rot}°
                        </div>
                      )}

                      {/* Hover Action Overlay for Individual Page Rotation */}
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                        <button
                          onClick={() => rotateSinglePage(idx, -90)}
                          className="p-2 rounded-full bg-white text-slate-800 hover:bg-sky-100 shadow-lg"
                          title="Rotate 90° Left"
                        >
                          <RotateCcw className="w-4 h-4 text-sky-600" />
                        </button>
                        <button
                          onClick={() => rotateSinglePage(idx, 90)}
                          className="p-2 rounded-full bg-white text-slate-800 hover:bg-sky-100 shadow-lg"
                          title="Rotate 90° Right"
                        >
                          <RotateCw className="w-4 h-4 text-sky-600" />
                        </button>
                      </div>
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
              <span>100% In-Browser &bull; Fast, non-destructive rotation.</span>
            </div>

            <button
              onClick={handleSaveAndDownload}
              disabled={isProcessing}
              className="w-full sm:w-auto px-8 py-3 rounded-xl bg-sky-600 hover:bg-sky-700 disabled:opacity-50 text-white font-bold text-sm shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Saving rotations...</span>
                </>
              ) : (
                <>
                  <Download className="w-4 h-4" />
                  <span>
                    Apply Rotations & Download PDF
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
