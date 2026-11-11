'use client';

import React, { useState, useRef } from 'react';
import Link from 'next/link';
import { 
  Hash, 
  UploadCloud, 
  Download, 
  ShieldCheck, 
  Zap, 
  AlertCircle, 
  Loader2, 
  ChevronRight, 
  FileCheck
} from 'lucide-react';
import { addPageNumbersClient, downloadPdfBlob } from '@/lib/pdf/wasm-pipeline';
import { PDFDocument } from 'pdf-lib';

export default function AddPageNumbersPage() {
  const [file, setFile] = useState<File | null>(null);
  const [pageCount, setPageCount] = useState<number>(0);
  const [position, setPosition] = useState<'bottom-center' | 'bottom-right' | 'top-right'>('bottom-center');
  const [startFrom, setStartFrom] = useState<number>(1);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const selected = e.target.files[0];
    
    if (!selected.name.endsWith('.pdf')) {
      setError('Please select a valid PDF file.');
      return;
    }

    try {
      const buffer = await selected.arrayBuffer();
      const doc = await PDFDocument.load(buffer, { ignoreEncryption: true });
      setFile(selected);
      setPageCount(doc.getPageCount());
      setError(null);
    } catch (err: any) {
      console.error(err);
      setError('Failed to read the selected PDF.');
    }
  };

  const handleApplyNumbers = async () => {
    if (!file) return;

    setIsProcessing(true);
    setError(null);

    try {
      const buffer = await file.arrayBuffer();
      const numberedBytes = await addPageNumbersClient(buffer, position, startFrom);
      
      const newName = file.name.replace('.pdf', '-numbered.pdf');
      downloadPdfBlob(numberedBytes, newName);
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Failed to add page numbers.');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-10">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-xs text-slate-500">
        <Link href="/" className="hover:text-brand-600">Home</Link>
        <ChevronRight className="w-3.5 h-3.5" />
        <span className="text-slate-900 dark:text-white font-medium">Page Numbers</span>
      </nav>

      {/* Header */}
      <div className="text-center space-y-3">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 text-xs font-semibold border border-emerald-200 dark:border-emerald-800/60">
          <Zap className="w-3.5 h-3.5 text-amber-500" />
          100% Client-Side WebAssembly &bull; Zero Server Latency
        </div>
        <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900 dark:text-white">
          Add Page Numbers to PDF
        </h1>
        <p className="text-sm sm:text-base text-slate-600 dark:text-slate-400 max-w-lg mx-auto">
          Stamp sequential page numbers (e.g. Page 1 of 24) with custom positioning. Zero server upload.
        </p>
      </div>

      {!file ? (
        <div
          onClick={() => fileInputRef.current?.click()}
          className="group relative border-2 border-dashed border-slate-300 dark:border-slate-700 hover:border-brand-500 rounded-3xl p-10 sm:p-14 text-center cursor-pointer bg-white/70 dark:bg-slate-900/70 hover:bg-brand-50/30 dark:hover:bg-brand-950/20 transition-all shadow-sm"
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,application/pdf"
            onChange={handleFileSelect}
            className="hidden"
          />

          <div className="flex flex-col items-center gap-3">
            <div className="w-16 h-16 rounded-2xl bg-brand-50 dark:bg-brand-950/80 text-brand-600 dark:text-brand-400 flex items-center justify-center group-hover:scale-110 transition-transform shadow-md shadow-brand-500/10">
              <UploadCloud className="w-8 h-8" />
            </div>
            <div>
              <span className="text-base font-bold text-slate-800 dark:text-slate-100">
                Click to select a PDF document
              </span>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Processed locally in your browser. Complete privacy.
              </p>
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-6 bg-white dark:bg-slate-900 rounded-3xl p-6 sm:p-8 border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="flex items-center justify-between pb-6 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-3">
              <FileCheck className="w-6 h-6 text-brand-600" />
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white truncate max-w-xs">{file.name}</h3>
                <p className="text-xs text-slate-400">{pageCount} total pages</p>
              </div>
            </div>
            <button
              onClick={() => { setFile(null); setPageCount(0); }}
              className="text-xs text-red-500 hover:underline"
            >
              Change File
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                Position on Page:
              </label>
              <select
                value={position}
                onChange={(e) => setPosition(e.target.value as any)}
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-brand-500"
              >
                <option value="bottom-center">Bottom Center (Default)</option>
                <option value="bottom-right">Bottom Right</option>
                <option value="top-right">Top Right</option>
              </select>
            </div>

            <div className="space-y-2">
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                Start Numbering From:
              </label>
              <input
                type="number"
                min="1"
                value={startFrom}
                onChange={(e) => setStartFrom(parseInt(e.target.value, 10) || 1)}
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>
          </div>

          {/* Action Row */}
          <div className="pt-4 flex flex-col sm:flex-row items-center justify-between gap-4 border-t border-slate-100 dark:border-slate-800">
            <div className="text-xs text-slate-500 flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-emerald-500" />
              <span>Processed locally in your browser &bull; Zero server egress</span>
            </div>

            <button
              onClick={handleApplyNumbers}
              disabled={isProcessing}
              className="w-full sm:w-auto px-6 py-3 rounded-xl bg-brand-600 hover:bg-brand-700 text-white font-bold text-sm shadow-lg shadow-brand-500/20 flex items-center justify-center gap-2 transition-all"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Numbering...</span>
                </>
              ) : (
                <>
                  <Hash className="w-4 h-4" />
                  <span>Add Page Numbers & Download</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2 p-4 rounded-xl bg-red-50 dark:bg-red-950/50 text-red-700 dark:text-red-300 text-sm border border-red-200 dark:border-red-800">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
}
