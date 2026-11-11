'use client';

import React, { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { 
  Eye, 
  Upload, 
  ZoomIn, 
  ZoomOut, 
  RotateCw, 
  ChevronLeft, 
  ChevronRight, 
  PanelLeft, 
  ShieldCheck, 
  FileText, 
  Download,
  Lock,
  Layers
} from 'lucide-react';
import * as pdfjsLib from 'pdfjs-dist';

if (typeof window !== 'undefined') {
  pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';
}

export default function PdfViewerPage() {
  const [file, setFile] = useState<File | null>(null);
  const [pdfDocProxy, setPdfDocProxy] = useState<pdfjsLib.PDFDocumentProxy | null>(null);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [scale, setScale] = useState<number>(1.25);
  const [rotation, setRotation] = useState<number>(0);
  const [isThumbnailsOpen, setIsThumbnailsOpen] = useState<boolean>(true);
  const [thumbnailUrls, setThumbnailUrls] = useState<Record<number, string>>({});
  const [isProcessing, setIsProcessing] = useState<boolean>(false);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handleFileSelect = async (uploadedFile: File) => {
    if (!uploadedFile) return;
    setFile(uploadedFile);
    setIsProcessing(true);

    try {
      const buffer = await uploadedFile.arrayBuffer();
      const loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(buffer).slice() });
      const doc = await loadingTask.promise;
      setPdfDocProxy(doc);
      setTotalPages(doc.numPages);
      setCurrentPage(1);
      setRotation(0);
      await renderPage(doc, 1, scale, 0);
      generateAllThumbnails(doc);
    } catch (e) {
      console.error('Error loading PDF in viewer:', e);
    } finally {
      setIsProcessing(false);
    }
  };

  const renderPage = async (
    doc: pdfjsLib.PDFDocumentProxy, 
    pageNum: number, 
    currentScale: number, 
    rot: number
  ) => {
    try {
      const page = await doc.getPage(pageNum);
      const viewport = page.getViewport({ scale: currentScale, rotation: (page.rotate + rot) % 360 });

      if (canvasRef.current) {
        canvasRef.current.width = viewport.width;
        canvasRef.current.height = viewport.height;
        const ctx = canvasRef.current.getContext('2d');
        if (ctx) {
          await page.render({ canvasContext: ctx, viewport }).promise;
        }
      }
    } catch (e) {
      console.error('Render error:', e);
    }
  };

  const generateAllThumbnails = async (doc: pdfjsLib.PDFDocumentProxy) => {
    for (let i = 1; i <= Math.min(doc.numPages, 30); i++) {
      try {
        const page = await doc.getPage(i);
        const viewport = page.getViewport({ scale: 0.25 });
        const offCanvas = document.createElement('canvas');
        offCanvas.width = viewport.width;
        offCanvas.height = viewport.height;
        const ctx = offCanvas.getContext('2d');
        if (ctx) {
          await page.render({ canvasContext: ctx, viewport }).promise;
          const url = offCanvas.toDataURL('image/jpeg', 0.5);
          setThumbnailUrls((prev) => ({ ...prev, [i]: url }));
        }
      } catch (err) {
        console.warn('Thumbnail err:', err);
      }
    }
  };

  const goToPage = (p: number) => {
    if (!pdfDocProxy || p < 1 || p > totalPages) return;
    setCurrentPage(p);
    renderPage(pdfDocProxy, p, scale, rotation);
  };

  const changeScale = (delta: number) => {
    if (!pdfDocProxy) return;
    const newScale = Math.min(2.5, Math.max(0.5, scale + delta));
    setScale(newScale);
    renderPage(pdfDocProxy, currentPage, newScale, rotation);
  };

  const rotate = () => {
    if (!pdfDocProxy) return;
    const newRot = (rotation + 90) % 360;
    setRotation(newRot);
    renderPage(pdfDocProxy, currentPage, scale, newRot);
  };

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-slate-950 flex flex-col">
      {/* Viewer Header */}
      <div className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-4 py-2.5 flex items-center justify-between sticky top-16 z-30 shadow-sm">
        <div className="flex items-center gap-3">
          {file && (
            <button
              onClick={() => setIsThumbnailsOpen(!isThumbnailsOpen)}
              className={`p-1.5 rounded-lg border transition-all ${
                isThumbnailsOpen ? 'bg-slate-100 dark:bg-slate-800 text-emerald-600' : 'text-slate-500'
              }`}
              title="Toggle Thumbnails"
            >
              <PanelLeft className="w-4 h-4" />
            </button>
          )}
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600">
              <Eye className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-800 dark:text-white truncate max-w-xs">
                {file ? file.name : 'PDF Viewer'}
              </h2>
              {file && (
                <span className="text-[11px] text-slate-400">
                  Page {currentPage} of {totalPages}
                </span>
              )}
            </div>
          </div>
        </div>

        {file ? (
          <div className="flex items-center gap-2 text-xs">
            {/* Pagination */}
            <div className="flex items-center gap-1 border-r pr-2 border-slate-200 dark:border-slate-700">
              <button
                onClick={() => goToPage(currentPage - 1)}
                disabled={currentPage <= 1}
                className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="font-semibold text-slate-700 dark:text-slate-200">
                {currentPage} / {totalPages}
              </span>
              <button
                onClick={() => goToPage(currentPage + 1)}
                disabled={currentPage >= totalPages}
                className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            {/* Zoom */}
            <div className="flex items-center gap-1 border-r pr-2 border-slate-200 dark:border-slate-700">
              <button
                onClick={() => changeScale(-0.25)}
                className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
                title="Zoom Out"
              >
                <ZoomOut className="w-4 h-4" />
              </button>
              <span className="w-10 text-center font-semibold text-slate-600">
                {Math.round(scale * 100)}%
              </span>
              <button
                onClick={() => changeScale(0.25)}
                className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
                title="Zoom In"
              >
                <ZoomIn className="w-4 h-4" />
              </button>
            </div>

            {/* Rotate */}
            <button
              onClick={rotate}
              className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600"
              title="Rotate Page"
            >
              <RotateCw className="w-4 h-4" />
            </button>

            <Link
              href="/edit-pdf"
              className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-sm transition-all"
            >
              Edit in Editor
            </Link>

            <button
              onClick={() => {
                setFile(null);
                setPdfDocProxy(null);
              }}
              className="px-2.5 py-1.5 rounded-lg text-xs text-slate-500 hover:bg-slate-100"
            >
              Close
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <Link
              href="/"
              className="text-xs text-slate-500 hover:text-slate-800"
            >
              Back to Home
            </Link>
          </div>
        )}
      </div>

      {/* Main Area */}
      <div className="flex-1 flex w-full relative overflow-hidden">
        {!file ? (
          <div className="flex-1 flex items-center justify-center p-6">
            <div
              onClick={() => fileInputRef.current?.click()}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                if (e.dataTransfer.files[0]) handleFileSelect(e.dataTransfer.files[0]);
              }}
              className="border-2 border-dashed border-slate-300 dark:border-slate-700 hover:border-emerald-500 bg-white dark:bg-slate-900 rounded-3xl p-12 text-center cursor-pointer transition-all shadow-md hover:shadow-xl max-w-lg w-full group"
            >
              <div className="w-16 h-16 rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform">
                <Upload className="w-8 h-8" />
              </div>
              <h3 className="text-xl font-bold text-slate-800 dark:text-white mb-2">
                Open PDF in Fast Viewer
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mb-6">
                Instant 0ms client-side rendering with full privacy
              </p>
              <button className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs shadow-md">
                Select PDF File
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="application/pdf"
                onChange={(e) => {
                  if (e.target.files?.[0]) handleFileSelect(e.target.files[0]);
                }}
                className="hidden"
              />
            </div>
          </div>
        ) : (
          <div className="flex-1 flex h-[calc(100vh-7rem)]">
            {/* Left Thumbnails */}
            {isThumbnailsOpen && (
              <aside className="w-52 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 p-3 space-y-3 overflow-y-auto shrink-0 shadow-lg">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">
                  Pages ({totalPages})
                </span>
                <div className="space-y-2">
                  {Array.from({ length: totalPages }).map((_, idx) => {
                    const pageNum = idx + 1;
                    const isActive = currentPage === pageNum;
                    const thumb = thumbnailUrls[pageNum];

                    return (
                      <div
                        key={pageNum}
                        onClick={() => goToPage(pageNum)}
                        className={`p-2 rounded-xl border text-center transition-all cursor-pointer ${
                          isActive
                            ? 'border-emerald-500 bg-emerald-50/70 dark:bg-emerald-950/40 ring-2 ring-emerald-400'
                            : 'border-slate-200 dark:border-slate-800 hover:border-slate-300'
                        }`}
                      >
                        <div className="aspect-[3/4] bg-white rounded-lg border overflow-hidden flex items-center justify-center shadow-inner">
                          {thumb ? (
                            <img src={thumb} alt={`Page ${pageNum}`} className="w-full h-full object-contain" />
                          ) : (
                            <span className="text-xs text-slate-400">{pageNum}</span>
                          )}
                        </div>
                        <span className="text-[11px] font-semibold text-slate-700 dark:text-slate-300 mt-1 block">
                          Page {pageNum}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </aside>
            )}

            {/* Canvas Viewport */}
            <div className="flex-1 overflow-auto p-6 flex justify-center items-start">
              <div className="bg-white shadow-2xl rounded-xl border border-slate-300 overflow-hidden">
                <canvas ref={canvasRef} className="block" />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
