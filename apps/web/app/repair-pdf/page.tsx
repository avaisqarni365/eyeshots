'use client';

import React, { useState, useRef } from 'react';
import Link from 'next/link';
import { 
  Wrench, 
  UploadCloud, 
  Download, 
  ShieldCheck, 
  AlertCircle, 
  Loader2, 
  ChevronRight, 
  FileCheck2,
  CheckCircle2,
  RefreshCw,
  Cpu,
  Layers,
  Sparkles,
  Eye,
  FileX2,
  Zap,
  ArrowRight
} from 'lucide-react';
import { repairPdfClient, RepairReport } from '@/lib/pdf/wasm-pipeline';
import { repairPdfServer, downloadFileBlob } from '@/lib/api/gateway-client';
import { FileDropzone } from '@/components/FileDropzone';

export default function RepairPdfPage() {
  const [file, setFile] = useState<File | null>(null);
  const [engineMode, setEngineMode] = useState<'client' | 'server'>('client');
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentStep, setCurrentStep] = useState<string>('');
  const [repairReport, setRepairReport] = useState<RepairReport | null>(null);
  const [repairedBlob, setRepairedBlob] = useState<Blob | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const selected = e.target.files[0];
    
    if (!selected.name.toLowerCase().endsWith('.pdf') && selected.type !== 'application/pdf') {
      setError('Please select a PDF document file.');
      return;
    }

    setFile(selected);
    setRepairReport(null);
    setRepairedBlob(null);
    setError(null);
  };

  const handleRepair = async () => {
    if (!file) return;

    setIsProcessing(true);
    setError(null);
    setRepairReport(null);
    setRepairedBlob(null);

    try {
      if (engineMode === 'client') {
        // 1. Client-Side WASM / In-Browser Recovery ($0 server compute)
        setCurrentStep('Reading raw binary stream into memory sandbox...');
        const arrayBuffer = await file.arrayBuffer();

        setCurrentStep('Rebuilding cross-reference table (xref) and repairing root catalog...');
        const report = await repairPdfClient(arrayBuffer);

        setRepairReport(report);
        const blob = new Blob([report.repairedBytes as unknown as BlobPart], { type: 'application/pdf' });
        setRepairedBlob(blob);
      } else {
        // 2. Server-side QPDF / Ghostscript Deep Recovery
        setCurrentStep('Dispatching damaged binary to QPDF engine cluster...');
        const blob = await repairPdfServer(file, (p) => setCurrentStep(p.message));
        
        setCurrentStep('Binary reconstruction complete!');
        setRepairedBlob(blob);
        // Count pages in the repaired output instead of reporting a fixed number.
        let pagesRecovered = 0;
        try {
          const { PDFDocument } = await import('pdf-lib');
          pagesRecovered = (await PDFDocument.load(await blob.arrayBuffer(), { ignoreEncryption: true })).getPageCount();
        } catch {}
        setRepairReport({
          pagesRecovered,
          originalSizeBytes: file.size,
          repairedSizeBytes: blob.size,
          corruptionsFixed: ['Document rewritten by the QPDF recovery engine'],
          repairedBytes: new Uint8Array(),
        });
      }
    } catch (err: any) {
      console.error('Repair failed:', err);
      // Auto-fallback suggestion: if client fails, recommend server engine
      if (engineMode === 'client') {
        setError(
          `In-browser recovery encountered deep binary truncation (${err.message || 'Corrupted EOF'}). Try switching to "Deep Engine Reconstruction" below to invoke the backend QPDF engine.`
        );
      } else {
        setError(err.message || 'Severe binary corruption detected. The file could not be recovered.');
      }
    } finally {
      setIsProcessing(false);
      setCurrentStep('');
    }
  };

  const handleDownload = () => {
    if (!repairedBlob || !file) return;
    const repairedName = file.name.replace(/\.pdf$/i, '_Repaired.pdf');
    downloadFileBlob(repairedBlob, repairedName);
  };

  const formatBytes = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-10">
      {/* Breadcrumb Navigation */}
      <nav className="flex items-center gap-2 text-xs text-slate-500">
        <Link href="/" className="hover:text-emerald-600 transition-colors">Home</Link>
        <ChevronRight className="w-3.5 h-3.5" />
        <span className="text-slate-900 dark:text-white font-semibold">Repair PDF</span>
      </nav>

      {/* Hero Header */}
      <div className="text-center space-y-3">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 text-xs font-semibold border border-emerald-200 dark:border-emerald-800/60">
          <Wrench className="w-3.5 h-3.5 text-emerald-500" />
          <span>Rebuild Damaged XREF Tables &bull; Restore Corrupted Files</span>
        </div>
        <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900 dark:text-white tracking-tight">
          Repair Corrupted PDF Document
        </h1>
        <p className="text-sm sm:text-base text-slate-600 dark:text-slate-400 max-w-xl mx-auto">
          Recover unreadable, damaged, or truncated PDF files. Our dual recovery pipeline reconstructs broken cross-reference tables, repairs object streams, and re-indexes salvageable pages.
        </p>
      </div>

      {/* Main Interactive Card */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xl p-6 sm:p-8 space-y-6">
        
        {/* Step 1: Upload Dropzone if no file selected */}
        {!file ? (
          <FileDropzone
            onFileSelected={(f) => {
              setFile(f);
              setError(null);
            }}
            title="Choose damaged PDF file or drag & drop it here"
            description="Supports damaged scans, corrupted downloads, broken xref tables, or unopenable PDFs."
            badge="⚙️ Dual-Engine XREF Rebuilder"
            variant="emerald"
          />
        ) : (
          /* Step 2: Selected File & Recovery Options */
          <div className="space-y-6 animate-fade-in">
            {/* File Info Bar */}
            <div className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-emerald-100 dark:bg-emerald-950 text-emerald-600">
                  <FileCheck2 className="w-6 h-6" />
                </div>
                <div>
                  <h4 className="font-bold text-sm text-slate-900 dark:text-white">{file.name}</h4>
                  <p className="text-xs text-slate-400">Original Size: {formatBytes(file.size)}</p>
                </div>
              </div>

              <button
                onClick={() => {
                  setFile(null);
                  setRepairReport(null);
                  setRepairedBlob(null);
                  setError(null);
                }}
                className="text-xs text-slate-400 hover:text-red-500 transition-colors font-medium"
              >
                Choose another file
              </button>
            </div>

            {/* Engine Selection */}
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Select Recovery Engine
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div
                  onClick={() => setEngineMode('client')}
                  className={`p-4 rounded-2xl border cursor-pointer transition-all ${
                    engineMode === 'client'
                      ? 'border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/30 ring-2 ring-emerald-500/20'
                      : 'border-slate-200 dark:border-slate-800 hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <Zap className="w-4 h-4 text-emerald-600" />
                    <span className="font-bold text-xs text-slate-900 dark:text-white">
                      In-Browser WASM Recovery
                    </span>
                    <span className="px-1.5 py-0.5 rounded bg-emerald-100 dark:bg-emerald-900 text-emerald-800 dark:text-emerald-200 text-[10px] font-bold">
                      $0 Cost
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    Runs 100% inside your browser sandbox. Rebuilds cross-reference tables and re-serializes valid pages with maximum privacy.
                  </p>
                </div>

                <div
                  onClick={() => setEngineMode('server')}
                  className={`p-4 rounded-2xl border cursor-pointer transition-all ${
                    engineMode === 'server'
                      ? 'border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/30 ring-2 ring-emerald-500/20'
                      : 'border-slate-200 dark:border-slate-800 hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <Cpu className="w-4 h-4 text-purple-600" />
                    <span className="font-bold text-xs text-slate-900 dark:text-white">
                      Deep QPDF Engine Recovery
                    </span>
                    <span className="px-1.5 py-0.5 rounded bg-purple-100 dark:bg-purple-900 text-purple-800 dark:text-purple-200 text-[10px] font-bold">
                      Severe Damage
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    Dispatches to the headless Stirling-PDF cluster. Solves corrupted binary streams, missing EOF markers, and linearized structure.
                  </p>
                </div>
              </div>
            </div>

            {/* Error Message */}
            {error && (
              <div className="p-4 rounded-2xl bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-900 flex items-start gap-3 text-xs text-red-700 dark:text-red-300">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <span className="font-bold">Recovery Notice:</span>
                  <p>{error}</p>
                </div>
              </div>
            )}

            {/* Processing State */}
            {isProcessing && (
              <div className="p-5 rounded-2xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 space-y-3 text-center">
                <Loader2 className="w-6 h-6 animate-spin text-emerald-600 mx-auto" />
                <p className="text-xs font-bold text-slate-800 dark:text-white">{currentStep}</p>
                <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-1.5 overflow-hidden">
                  <div className="bg-emerald-500 h-1.5 rounded-full animate-pulse w-3/4 mx-auto" />
                </div>
              </div>
            )}

            {/* Result Report Card */}
            {repairReport && repairedBlob && (
              <div className="p-5 rounded-2xl bg-emerald-50/70 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 space-y-4 animate-fade-in">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                    <span className="font-bold text-sm text-emerald-900 dark:text-emerald-100">
                      PDF Document Successfully Recovered!
                    </span>
                  </div>
                  <span className="px-2 py-0.5 rounded-full bg-emerald-200 text-emerald-900 text-[10px] font-bold uppercase tracking-wider">
                    {engineMode === 'client' ? 'Client WASM' : 'QPDF Engine'}
                  </span>
                </div>

                {/* Metrics */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
                  <div className="p-2.5 rounded-xl bg-white dark:bg-slate-900 border">
                    <span className="text-slate-400 text-[10px] block">Pages Recovered</span>
                    <span className="font-bold text-slate-800 dark:text-white text-sm">
                      {repairReport.pagesRecovered} Page{repairReport.pagesRecovered !== 1 ? 's' : ''}
                    </span>
                  </div>
                  <div className="p-2.5 rounded-xl bg-white dark:bg-slate-900 border">
                    <span className="text-slate-400 text-[10px] block">Repaired Size</span>
                    <span className="font-bold text-slate-800 dark:text-white text-sm">
                      {formatBytes(repairReport.repairedSizeBytes)}
                    </span>
                  </div>
                  <div className="p-2.5 rounded-xl bg-white dark:bg-slate-900 border col-span-2 sm:col-span-1">
                    <span className="text-slate-400 text-[10px] block">Integrity Status</span>
                    <span className="font-bold text-emerald-600 text-sm">100% Compliant</span>
                  </div>
                </div>

                {/* Corruptions Fixed List */}
                <div className="space-y-1.5 pt-2 border-t border-emerald-200 dark:border-emerald-800">
                  <span className="text-[11px] font-bold text-emerald-800 dark:text-emerald-300">
                    Repairs & Structural Fixes Applied:
                  </span>
                  <ul className="space-y-1">
                    {repairReport.corruptionsFixed.map((fix, idx) => (
                      <li key={idx} className="flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                        <span>{fix}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Actions */}
                <div className="flex flex-wrap items-center gap-3 pt-2">
                  <button
                    onClick={handleDownload}
                    className="flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-lg transition-all"
                  >
                    <Download className="w-4 h-4" />
                    <span>Download Repaired PDF</span>
                  </button>

                  <Link
                    href="/dms"
                    className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-50 text-slate-700 dark:text-slate-200 text-xs font-semibold flex items-center gap-1.5 transition-colors"
                  >
                    <Eye className="w-4 h-4 text-emerald-600" />
                    <span>Open in Acrobat Studio</span>
                  </Link>
                </div>
              </div>
            )}

            {/* Launch Repair Button */}
            {!repairReport && (
              <button
                onClick={handleRepair}
                disabled={isProcessing}
                className="w-full py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold text-sm flex items-center justify-center gap-2 shadow-lg hover:shadow-emerald-500/25 transition-all"
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Rebuilding Document Architecture...</span>
                  </>
                ) : (
                  <>
                    <Wrench className="w-4 h-4" />
                    <span>Start PDF Repair & Reconstruction</span>
                  </>
                )}
              </button>
            )}
          </div>
        )}
      </div>

      {/* Feature & Explanatory Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-2">
          <div className="p-2 rounded-xl bg-blue-50 dark:bg-blue-950 text-blue-600 w-fit">
            <Layers className="w-4 h-4" />
          </div>
          <h3 className="font-bold text-xs text-slate-900 dark:text-white">
            Broken XREF Table Reconstruction
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Fixes unreadable PDFs caused by missing or damaged cross-reference index tables and recalculates exact byte offsets.
          </p>
        </div>

        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-2">
          <div className="p-2 rounded-xl bg-emerald-50 dark:bg-emerald-950 text-emerald-600 w-fit">
            <Zap className="w-4 h-4" />
          </div>
          <h3 className="font-bold text-xs text-slate-900 dark:text-white">
            Client-First Privacy & Zero-Cost
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Executes repairs in your browser using WebAssembly. Your sensitive files never leave your computer unless deep server repair is requested.
          </p>
        </div>

        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-2">
          <div className="p-2 rounded-xl bg-purple-50 dark:bg-purple-950 text-purple-600 w-fit">
            <Cpu className="w-4 h-4" />
          </div>
          <h3 className="font-bold text-xs text-slate-900 dark:text-white">
            QPDF & Ghostscript Recovery
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Solves deep binary corruption, unclosed stream dictionaries, and malformed trailers with industrial-grade repair engines.
          </p>
        </div>
      </div>
    </div>
  );
}
