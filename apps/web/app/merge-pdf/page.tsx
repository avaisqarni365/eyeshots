'use client';

import React, { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { 
  Combine, 
  UploadCloud, 
  FileText, 
  ArrowUp, 
  ArrowDown, 
  Trash2, 
  Download, 
  ShieldCheck, 
  Zap, 
  CheckCircle2, 
  AlertCircle,
  Loader2,
  ChevronRight,
  RotateCw,
  Shuffle,
  Layers,
  LayoutGrid,
  List,
  Eye,
  Plus
} from 'lucide-react';
import { mergePdfsClient, alternateAndMixClient, downloadPdfBlob } from '@/lib/pdf/wasm-pipeline';
import { renderPageThumbnail } from '@/lib/pdf/thumbnail-generator';
import { PDFDocument, degrees } from 'pdf-lib';
import * as pdfjsLib from 'pdfjs-dist';

if (typeof window !== 'undefined') {
  pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';
}

interface UploadedFile {
  id: string;
  file: File;
  name: string;
  size: number;
  pageCount: number;
}

interface PageItem {
  id: string;
  fileId: string;
  fileName: string;
  originalPageNumber: number; // 1-indexed in source file
  rotation: number;
  thumbnailUrl?: string;
}

export default function MergePdfPage() {
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [viewMode, setViewMode] = useState<'files' | 'pages'>('files');
  const [pages, setPages] = useState<PageItem[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Smart options
  const [isAlternateMix, setIsAlternateMix] = useState(false);
  const [reverseSecondDoc, setReverseSecondDoc] = useState(false);
  const [addBlankIfOdd, setAddBlankIfOdd] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Extract page items and thumbnails when files change
  const loadThumbnailsForFile = async (uploadedFile: UploadedFile, fileObj: File) => {
    try {
      const buffer = await fileObj.arrayBuffer();
      const loadingTask = pdfjsLib.getDocument({
        data: new Uint8Array(buffer).slice(),
        cMapUrl: '/pdfjs/cmaps/',
        cMapPacked: true,
      });
      const doc = await loadingTask.promise;
      const count = doc.numPages;

      const newPageItems: PageItem[] = [];
      for (let i = 1; i <= count; i++) {
        let thumbUrl = '';
        try {
          thumbUrl = await renderPageThumbnail(doc, i, 160);
        } catch (e) {
          console.warn('Thumb fail:', e);
        }
        newPageItems.push({
          id: `${uploadedFile.id}-p${i}`,
          fileId: uploadedFile.id,
          fileName: uploadedFile.name,
          originalPageNumber: i,
          rotation: 0,
          thumbnailUrl: thumbUrl,
        });
      }

      setPages((prev) => [...prev, ...newPageItems]);
    } catch (e) {
      console.error('Failed to load thumbnails:', e);
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    const selected = Array.from(e.target.files).filter(
      (f) => f.type === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf')
    );

    if (selected.length === 0) {
      setError('Please select valid PDF documents.');
      return;
    }

    const addedFiles: UploadedFile[] = [];
    for (const f of selected) {
      try {
        const buffer = await f.arrayBuffer();
        const doc = await PDFDocument.load(buffer, { ignoreEncryption: true });
        const count = doc.getPageCount();
        const uFile: UploadedFile = {
          id: Math.random().toString(36).substring(2, 9),
          file: f,
          name: f.name,
          size: f.size,
          pageCount: count,
        };
        addedFiles.push(uFile);
        loadThumbnailsForFile(uFile, f);
      } catch (err: any) {
        console.error('Error loading pdf:', err);
      }
    }

    setFiles((prev) => [...prev, ...addedFiles]);
    setError(null);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    if (!e.dataTransfer.files) return;
    const dropped = Array.from(e.dataTransfer.files).filter(
      (f) => f.type === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf')
    );

    if (dropped.length === 0) {
      setError('Only PDF files are supported.');
      return;
    }

    const addedFiles: UploadedFile[] = [];
    for (const f of dropped) {
      try {
        const buffer = await f.arrayBuffer();
        const doc = await PDFDocument.load(buffer, { ignoreEncryption: true });
        const count = doc.getPageCount();
        const uFile: UploadedFile = {
          id: Math.random().toString(36).substring(2, 9),
          file: f,
          name: f.name,
          size: f.size,
          pageCount: count,
        };
        addedFiles.push(uFile);
        loadThumbnailsForFile(uFile, f);
      } catch (err: any) {
        console.error('Error loading pdf:', err);
      }
    }

    setFiles((prev) => [...prev, ...addedFiles]);
    setError(null);
  };

  const moveUp = (index: number) => {
    if (index === 0) return;
    const updated = [...files];
    const [moved] = updated.splice(index, 1);
    updated.splice(index - 1, 0, moved);
    setFiles(updated);
  };

  const moveDown = (index: number) => {
    if (index === files.length - 1) return;
    const updated = [...files];
    const [moved] = updated.splice(index, 1);
    updated.splice(index + 1, 0, moved);
    setFiles(updated);
  };

  const removeFile = (id: string) => {
    setFiles((prev) => prev.filter((f) => f.id !== id));
    setPages((prev) => prev.filter((p) => p.fileId !== id));
  };

  // Page level controls
  const rotatePage = (pageId: string) => {
    setPages((prev) =>
      prev.map((p) => (p.id === pageId ? { ...p, rotation: (p.rotation + 90) % 360 } : p))
    );
  };

  const deletePage = (pageId: string) => {
    setPages((prev) => prev.filter((p) => p.id !== pageId));
  };

  const movePageLeft = (index: number) => {
    if (index === 0) return;
    const updated = [...pages];
    const [moved] = updated.splice(index, 1);
    updated.splice(index - 1, 0, moved);
    setPages(updated);
  };

  const movePageRight = (index: number) => {
    if (index === pages.length - 1) return;
    const updated = [...pages];
    const [moved] = updated.splice(index, 1);
    updated.splice(index + 1, 0, moved);
    setPages(updated);
  };

  // Perform Merge Operation
  const handleMerge = async () => {
    if (files.length < 2) {
      setError('Please add at least 2 PDF files to combine.');
      return;
    }

    setIsProcessing(true);
    setStatusMessage('Merging documents client-side in browser sandbox...');
    setError(null);

    try {
      if (isAlternateMix && files.length === 2) {
        // Alternate & Mix mode
        const bufA = await files[0].file.arrayBuffer();
        const bufB = await files[1].file.arrayBuffer();
        const resultBytes = await alternateAndMixClient(bufA, bufB, reverseSecondDoc);
        downloadPdfBlob(resultBytes, 'alternate-mixed.pdf');
        setStatusMessage('Merged & mixed successfully!');
        setIsProcessing(false);
        return;
      }

      if (viewMode === 'pages' && pages.length > 0) {
        // Page-by-page custom merge
        const mergedDoc = await PDFDocument.create();
        const fileBuffers: Record<string, PDFDocument> = {};

        for (const fileItem of files) {
          const buf = await fileItem.file.arrayBuffer();
          fileBuffers[fileItem.id] = await PDFDocument.load(buf, { ignoreEncryption: true });
        }

        for (const p of pages) {
          const srcDoc = fileBuffers[p.fileId];
          if (!srcDoc) continue;
          const [copiedPage] = await mergedDoc.copyPages(srcDoc, [p.originalPageNumber - 1]);
          if (p.rotation !== 0) {
            const current = copiedPage.getRotation().angle;
            copiedPage.setRotation(degrees((current + p.rotation) % 360));
          }
          mergedDoc.addPage(copiedPage);
        }

        const mergedBytes = await mergedDoc.save();
        downloadPdfBlob(mergedBytes, 'merged-custom-pages.pdf');
        setStatusMessage('Pages combined successfully!');
      } else {
        // Files Mode standard merge
        const fileBuffers = await Promise.all(files.map((f) => f.file.arrayBuffer()));
        const mergedBytes = await mergePdfsClient(fileBuffers);
        downloadPdfBlob(mergedBytes, 'combined-document.pdf');
        setStatusMessage('Combined successfully!');
      }
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Failed to merge documents.');
    } finally {
      setIsProcessing(false);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const totalPageCount = files.reduce((acc, f) => acc + f.pageCount, 0);

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8 select-none">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-xs text-slate-500">
        <Link href="/" className="hover:text-sky-600">Home</Link>
        <ChevronRight className="w-3.5 h-3.5" />
        <span className="text-slate-900 dark:text-white font-medium">Merge PDF</span>
      </nav>

      {/* Header */}
      <div className="text-center space-y-3">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-sky-50 dark:bg-sky-950/60 text-sky-700 dark:text-sky-300 text-xs font-semibold border border-sky-200 dark:border-sky-800/60">
          <Zap className="w-3.5 h-3.5 text-amber-500" />
          100% Client-Side WebAssembly &bull; Zero Server Upload
        </div>
        <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900 dark:text-white">
          Merge PDF Documents
        </h1>
        <p className="text-sm sm:text-base text-slate-600 dark:text-slate-400 max-w-xl mx-auto">
          Combine multiple PDFs into a single unified document with custom page reordering, rotation, and alternate mixing.
        </p>
      </div>

      {/* Upload Drop Zone */}
      <div
        onDragOver={(e) => e.preventDefault()}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className="group relative border-2 border-dashed border-sky-300 dark:border-sky-700/80 hover:border-sky-500 rounded-3xl p-8 sm:p-12 text-center cursor-pointer bg-white/70 dark:bg-slate-900/70 hover:bg-sky-50/40 dark:hover:bg-sky-950/20 transition-all shadow-sm"
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,application/pdf"
          multiple
          onChange={handleFileSelect}
          className="hidden"
        />

        <div className="flex flex-col items-center gap-3">
          <div className="w-16 h-16 rounded-2xl bg-sky-50 dark:bg-sky-950 text-sky-600 dark:text-sky-400 flex items-center justify-center group-hover:scale-110 transition-transform shadow-md shadow-sky-500/10">
            <UploadCloud className="w-8 h-8" />
          </div>
          <div>
            <span className="text-base font-bold text-slate-800 dark:text-slate-100">
              Click to select PDF files or drop them here
            </span>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Select 2 or more files &bull; Fast local processing with no file size limits
            </p>
          </div>
        </div>
      </div>

      {/* Error & Status */}
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

      {files.length > 0 && (
        <div className="space-y-6">
          {/* Smart Layout Master Toolbar */}
          <div className="flex flex-wrap items-center justify-between gap-4 p-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
            {/* View Mode Toggle: Files vs Pages */}
            <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
              <button
                onClick={() => setViewMode('files')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  viewMode === 'files'
                    ? 'bg-white dark:bg-slate-700 text-sky-700 dark:text-sky-300 shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                }`}
              >
                <List className="w-4 h-4" />
                <span>Files Mode ({files.length})</span>
              </button>
              <button
                onClick={() => setViewMode('pages')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  viewMode === 'pages'
                    ? 'bg-white dark:bg-slate-700 text-sky-700 dark:text-sky-300 shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                }`}
              >
                <LayoutGrid className="w-4 h-4" />
                <span>Pages Mode ({pages.length || totalPageCount})</span>
              </button>
            </div>

            {/* Smart Merge Presets / Operations */}
            <div className="flex items-center gap-2 flex-wrap">
              {files.length === 2 && (
                <button
                  onClick={() => setIsAlternateMix(!isAlternateMix)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all ${
                    isAlternateMix
                      ? 'bg-purple-100 text-purple-800 border-purple-300 dark:bg-purple-950 dark:text-purple-300 ring-2 ring-purple-400'
                      : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 hover:bg-slate-50'
                  }`}
                  title="Alternate & Mix: Interleave odd pages from file 1 and even pages from file 2"
                >
                  <Shuffle className="w-3.5 h-3.5 text-purple-600" />
                  <span>Alternate & Mix</span>
                </button>
              )}

              {isAlternateMix && (
                <label className="flex items-center gap-1.5 text-xs text-purple-800 dark:text-purple-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={reverseSecondDoc}
                    onChange={(e) => setReverseSecondDoc(e.target.checked)}
                    className="accent-purple-600"
                  />
                  <span>Reverse 2nd file (Duplex)</span>
                </label>
              )}

              <button
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center gap-1 px-3 py-1.5 rounded-xl border border-slate-200 hover:bg-slate-100 text-xs text-slate-700 dark:text-slate-300"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add More PDFs</span>
              </button>

              <button
                onClick={() => { setFiles([]); setPages([]); }}
                className="px-3 py-1.5 rounded-xl text-xs text-red-500 hover:bg-red-50 transition-colors"
              >
                Clear All
              </button>
            </div>
          </div>

          {/* VIEW MODE 1: FILES LIST */}
          {viewMode === 'files' ? (
            <div className="space-y-2">
              {files.map((fileItem, idx) => (
                <div
                  key={fileItem.id}
                  className="flex items-center justify-between p-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm hover:border-sky-300 transition-colors"
                >
                  <div className="flex items-center gap-3 overflow-hidden">
                    <span className="w-6 h-6 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 text-xs font-bold flex items-center justify-center shrink-0">
                      {idx + 1}
                    </span>
                    <FileText className="w-5 h-5 text-sky-600 shrink-0" />
                    <div className="truncate">
                      <h4 className="text-sm font-semibold text-slate-800 dark:text-white truncate">
                        {fileItem.name}
                      </h4>
                      <p className="text-xs text-slate-400">
                        {fileItem.pageCount} pages &bull; {formatFileSize(fileItem.size)}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => moveUp(idx)}
                      disabled={idx === 0}
                      className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 disabled:opacity-30"
                      title="Move Up"
                    >
                      <ArrowUp className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => moveDown(idx)}
                      disabled={idx === files.length - 1}
                      className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 disabled:opacity-30"
                      title="Move Down"
                    >
                      <ArrowDown className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => removeFile(fileItem.id)}
                      className="p-1.5 rounded-lg hover:bg-red-50 text-red-500"
                      title="Remove"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            /* VIEW MODE 2: PAGES GRID (Visual Sejda Style) */
            <div className="space-y-3">
              <div className="flex justify-between items-center text-xs text-slate-500 px-1">
                <span>Drag or use arrows to reorder individual pages across documents.</span>
                <span className="font-semibold text-sky-600">{pages.length} total pages ready</span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3 max-h-[600px] overflow-y-auto p-2 bg-slate-100/50 dark:bg-slate-900/50 rounded-2xl border">
                {pages.map((p, idx) => (
                  <div
                    key={p.id}
                    className="group relative bg-white dark:bg-slate-800 rounded-xl p-2 border border-slate-200 dark:border-slate-700 shadow-sm hover:shadow-md transition-all flex flex-col items-center"
                  >
                    {/* Thumbnail */}
                    <div className="relative w-full aspect-[3/4] bg-slate-50 dark:bg-slate-900 rounded overflow-hidden flex items-center justify-center">
                      {p.thumbnailUrl ? (
                        <img
                          src={p.thumbnailUrl}
                          alt={`Page ${idx + 1}`}
                          className="w-full h-full object-contain transition-transform"
                          style={{ transform: `rotate(${p.rotation}deg)` }}
                        />
                      ) : (
                        <div className="flex flex-col items-center text-slate-400 text-xs">
                          <Loader2 className="w-4 h-4 animate-spin mb-1 text-sky-500" />
                          <span>Rendering...</span>
                        </div>
                      )}

                      {/* Hover action overlay */}
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1.5">
                        <button
                          onClick={() => rotatePage(p.id)}
                          className="p-1.5 rounded-full bg-white text-slate-800 hover:bg-sky-100 shadow"
                          title="Rotate 90° Clockwise"
                        >
                          <RotateCw className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => deletePage(p.id)}
                          className="p-1.5 rounded-full bg-white text-red-600 hover:bg-red-100 shadow"
                          title="Delete Page"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Metadata & Move Controls */}
                    <div className="w-full flex items-center justify-between mt-2 pt-1 border-t text-[11px] text-slate-500">
                      <span className="font-bold text-slate-700 dark:text-slate-300 truncate max-w-[70px]" title={p.fileName}>
                        #{idx + 1} ({p.originalPageNumber})
                      </span>
                      <div className="flex items-center">
                        <button
                          onClick={() => movePageLeft(idx)}
                          disabled={idx === 0}
                          className="p-1 hover:text-sky-600 disabled:opacity-20"
                        >
                          ◀
                        </button>
                        <button
                          onClick={() => movePageRight(idx)}
                          disabled={idx === pages.length - 1}
                          className="p-1 hover:text-sky-600 disabled:opacity-20"
                        >
                          ▶
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Bottom Action Footer */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-6 border-t border-slate-200 dark:border-slate-800">
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <ShieldCheck className="w-4 h-4 text-emerald-500" />
              <span>Processed locally. Total {totalPageCount} pages will be merged into 1 PDF.</span>
            </div>

            <button
              onClick={handleMerge}
              disabled={isProcessing || files.length < 2}
              className="w-full sm:w-auto px-8 py-3 rounded-xl bg-sky-600 hover:bg-sky-700 disabled:opacity-50 text-white font-bold text-sm shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Combining PDFs...</span>
                </>
              ) : (
                <>
                  <Download className="w-4 h-4" />
                  <span>
                    {isAlternateMix ? 'Alternate & Mix PDFs' : 'Merge PDF Documents'}
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
