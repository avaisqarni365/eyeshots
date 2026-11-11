'use client';

import React, { useState, useRef } from 'react';
import Link from 'next/link';
import { 
  FileText, 
  UploadCloud, 
  Download, 
  ShieldCheck, 
  Cpu, 
  AlertCircle, 
  Loader2, 
  ChevronRight, 
  FileCheck
} from 'lucide-react';
import { pdfToWordServer, downloadFileBlob } from '@/lib/api/gateway-client';

export default function PdfToWordPage() {
  const [file, setFile] = useState<File | null>(null);
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

  const handleConvert = async () => {
    if (!file) return;

    setIsProcessing(true);
    setStatusMessage('Uploading to headless LibreOffice conversion cluster...');
    setError(null);

    try {
      setStatusMessage('Extracting document layout, formatting, and tables to Word DOCX...');
      const docxBlob = await pdfToWordServer(file, (p) => setStatusMessage(p.message));
      
      const newName = file.name.replace('.pdf', '.docx');
      downloadFileBlob(docxBlob, newName);
      setStatusMessage('Success! Microsoft Word file downloaded.');
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Conversion failed on server.');
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
        <span className="text-slate-900 dark:text-white font-medium">PDF to Word</span>
      </nav>

      {/* Header */}
      <div className="text-center space-y-3">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 text-xs font-semibold border border-indigo-200 dark:border-indigo-800/60">
          <Cpu className="w-3.5 h-3.5 text-indigo-500" />
          Headless LibreOffice Engine &bull; Layout Geometry Preservation
        </div>
        <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900 dark:text-white">
          Convert PDF to Word (.docx)
        </h1>
        <p className="text-sm sm:text-base text-slate-600 dark:text-slate-400 max-w-lg mx-auto">
          Convert your PDF into fully editable Microsoft Word documents while preserving tables, paragraphs, and styles.
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
            <div className="w-16 h-16 rounded-2xl bg-indigo-50 dark:bg-indigo-950/80 text-indigo-600 dark:text-indigo-400 flex items-center justify-center group-hover:scale-110 transition-transform shadow-md shadow-indigo-500/10">
              <UploadCloud className="w-8 h-8" />
            </div>
            <div>
              <span className="text-base font-bold text-slate-800 dark:text-slate-100">
                Click to select a PDF to convert to Word
              </span>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Zero retention. Automatically deleted after 2 hours.
              </p>
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-6 bg-white dark:bg-slate-900 rounded-3xl p-6 sm:p-8 border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="flex items-center justify-between pb-6 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-3">
              <FileCheck className="w-6 h-6 text-indigo-600" />
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white truncate max-w-xs">{file.name}</h3>
                <p className="text-xs text-slate-400">Target output: Microsoft Word (.docx)</p>
              </div>
            </div>
            <button
              onClick={() => setFile(null)}
              className="text-xs text-red-500 hover:underline"
            >
              Change File
            </button>
          </div>

          {/* Action Row */}
          <div className="pt-4 flex flex-col sm:flex-row items-center justify-between gap-4 border-t border-slate-100 dark:border-slate-800">
            <div className="text-xs text-slate-500 flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-emerald-500" />
              <span>Strict 120-minute ephemeral purge &bull; Zero permanent storage</span>
            </div>

            <button
              onClick={handleConvert}
              disabled={isProcessing}
              className="w-full sm:w-auto px-6 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm shadow-lg shadow-indigo-500/20 flex items-center justify-center gap-2 transition-all"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Converting to Word...</span>
                </>
              ) : (
                <>
                  <FileText className="w-4 h-4" />
                  <span>Convert to DOCX</span>
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
