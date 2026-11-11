'use client';

import React, { useState, useRef } from 'react';
import Link from 'next/link';
import { 
  FileArchive, 
  UploadCloud, 
  Download, 
  ShieldCheck, 
  Cpu, 
  AlertCircle, 
  Loader2, 
  ChevronRight, 
  FileCheck,
  CheckCircle2
} from 'lucide-react';
import { compressPdfServer, downloadFileBlob } from '@/lib/api/gateway-client';
import { FileDropzone } from '@/components/FileDropzone';

export default function CompressPdfPage() {
  const [file, setFile] = useState<File | null>(null);
  const [optimizeLevel, setOptimizeLevel] = useState<'1' | '2' | '3'>('2');
  const [isProcessing, setIsProcessing] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const selected = e.target.files[0];
    
    if (!selected.name.endsWith('.pdf')) {
      setError('Please select a valid PDF file.');
      return;
    }

    setFile(selected);
    setError(null);
  };

  const handleCompress = async () => {
    if (!file) return;

    setIsProcessing(true);
    setStatusMessage('Uploading to headless Ghostscript engine...');
    setError(null);

    try {
      setStatusMessage('Downsampling vector images & deflating streams...');
      const compressedBlob = await compressPdfServer(file, { optimizeLevel }, (p) => setStatusMessage(p.message));
      
      const newName = file.name.replace('.pdf', '-compressed.pdf');
      downloadFileBlob(compressedBlob, newName);
      setStatusMessage('Compression complete! File downloaded.');
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Compression failed on server.');
    } finally {
      setIsProcessing(false);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-10">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-xs text-slate-500">
        <Link href="/" className="hover:text-brand-600">Home</Link>
        <ChevronRight className="w-3.5 h-3.5" />
        <span className="text-slate-900 dark:text-white font-medium">Compress PDF</span>
      </nav>

      {/* Header */}
      <div className="text-center space-y-3">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 text-xs font-semibold border border-indigo-200 dark:border-indigo-800/60">
          <Cpu className="w-3.5 h-3.5 text-indigo-500" />
          Ghostscript Downsampling Engine &bull; Strict 2-Hour Auto-Purge
        </div>
        <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900 dark:text-white">
          Compress PDF Online
        </h1>
        <p className="text-sm sm:text-base text-slate-600 dark:text-slate-400 max-w-lg mx-auto">
          Reduce file size by up to 90% while maintaining crisp document text and vector clarity.
        </p>
      </div>

      {!file ? (
        <FileDropzone
          onFileSelected={(f) => {
            setFile(f);
            setError(null);
          }}
          title="Click to select or drag & drop a PDF to compress"
          description="Ghostscript downsampling engine reduces size by up to 90%. Files auto-purge in 2 hours."
          badge="⚡ Extreme Ghostscript Downsampling"
          variant="indigo"
        />
      ) : (
        <div className="space-y-6 bg-white dark:bg-slate-900 rounded-3xl p-6 sm:p-8 border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="flex items-center justify-between pb-6 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-3">
              <FileCheck className="w-6 h-6 text-indigo-600" />
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white truncate max-w-xs">{file.name}</h3>
                <p className="text-xs text-slate-400">Original Size: {formatFileSize(file.size)}</p>
              </div>
            </div>
            <button
              onClick={() => setFile(null)}
              className="text-xs text-red-500 hover:underline"
            >
              Change File
            </button>
          </div>

          {/* Compression Level Selector */}
          <div className="space-y-3">
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
              Select Compression Preset:
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <button
                type="button"
                onClick={() => setOptimizeLevel('1')}
                className={`p-4 rounded-2xl border text-left transition-all ${
                  optimizeLevel === '1'
                    ? 'border-indigo-600 bg-indigo-50/60 dark:bg-indigo-950/40 ring-2 ring-indigo-500/20'
                    : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800'
                }`}
              >
                <div className="text-sm font-bold text-slate-900 dark:text-white">Low Compression</div>
                <div className="text-xs text-slate-500 mt-1">Maximum image quality, modest size reduction (~30%).</div>
              </button>

              <button
                type="button"
                onClick={() => setOptimizeLevel('2')}
                className={`p-4 rounded-2xl border text-left transition-all ${
                  optimizeLevel === '2'
                    ? 'border-indigo-600 bg-indigo-50/60 dark:bg-indigo-950/40 ring-2 ring-indigo-500/20'
                    : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800'
                }`}
              >
                <div className="text-sm font-bold text-indigo-600 dark:text-indigo-400">Medium (Recommended)</div>
                <div className="text-xs text-slate-500 mt-1">Optimal balance of sharp text and small size (~60%).</div>
              </button>

              <button
                type="button"
                onClick={() => setOptimizeLevel('3')}
                className={`p-4 rounded-2xl border text-left transition-all ${
                  optimizeLevel === '3'
                    ? 'border-indigo-600 bg-indigo-50/60 dark:bg-indigo-950/40 ring-2 ring-indigo-500/20'
                    : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800'
                }`}
              >
                <div className="text-sm font-bold text-slate-900 dark:text-white">Extreme Compression</div>
                <div className="text-xs text-slate-500 mt-1">Maximum compression for email attachment limits (~80%).</div>
              </button>
            </div>
          </div>

          {/* Action Row */}
          <div className="pt-4 flex flex-col sm:flex-row items-center justify-between gap-4 border-t border-slate-100 dark:border-slate-800">
            <div className="text-xs text-slate-500 flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-emerald-500" />
              <span>Auto-deleted after 120 minutes &bull; Ephemeral Janitor policy</span>
            </div>

            <button
              onClick={handleCompress}
              disabled={isProcessing}
              className="w-full sm:w-auto px-6 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm shadow-lg shadow-indigo-500/20 flex items-center justify-center gap-2 transition-all"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Processing...</span>
                </>
              ) : (
                <>
                  <FileArchive className="w-4 h-4" />
                  <span>Compress PDF</span>
                </>
              )}
            </button>
          </div>

          {statusMessage && (
            <div className="text-center text-xs font-medium text-indigo-600 dark:text-indigo-400 pt-2">
              {statusMessage}
            </div>
          )}
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
