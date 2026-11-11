'use client';

import React, { useState, useRef } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { PDFDocument } from 'pdf-lib';
import { 
  PenTool, 
  UploadCloud, 
  ShieldCheck, 
  ChevronRight, 
  AlertCircle,
  FileCheck,
  CheckSquare
} from 'lucide-react';

const PdfEditor = dynamic(
  () => import('@/components/editor/PdfEditor').then((mod) => mod.PdfEditor),
  { ssr: false }
);

export default function FillAndSignPage() {
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const processFile = (selected: File) => {
    if (!selected.name.toLowerCase().endsWith('.pdf') && selected.type !== 'application/pdf') {
      setError('Please select a valid PDF file.');
      return;
    }
    setFile(selected);
    setError(null);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    processFile(e.target.files[0]);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  const handleStartBlankDocument = async () => {
    try {
      const blankDoc = await PDFDocument.create();
      blankDoc.addPage([612, 792]);
      const pdfBytes = await blankDoc.save();
      const blankFile = new File([pdfBytes as unknown as BlobPart], 'blank-contract.pdf', {
        type: 'application/pdf',
      });
      setFile(blankFile);
      setError(null);
    } catch (err: any) {
      setError('Failed to create blank document: ' + err.message);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-xs text-slate-500">
        <Link href="/" className="hover:text-emerald-600">Home</Link>
        <ChevronRight className="w-3.5 h-3.5" />
        <span className="text-slate-900 dark:text-white font-medium">Fill &amp; Sign</span>
      </nav>

      {!file ? (
        <div className="space-y-10 py-6">
          <div className="text-center space-y-3">
            <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900 dark:text-white">
              Fill &amp; Sign PDF Documents Online
            </h1>
            <p className="text-lg font-medium text-emerald-600 dark:text-emerald-400">
              Easily complete PDF forms, add checkmarks, and sign contracts
            </p>
          </div>

          {/* Sejda-Style Upload & Drop Zone */}
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={`border-2 border-dashed rounded-3xl p-10 sm:p-14 text-center bg-white dark:bg-slate-900 transition-all shadow-sm max-w-2xl mx-auto space-y-5 ${
              isDragging 
                ? 'border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/30' 
                : 'border-slate-300 dark:border-slate-700 hover:border-emerald-500'
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,application/pdf"
              onChange={handleFileSelect}
              className="hidden"
            />

            <div className="flex flex-col items-center gap-3">
              <button
                onClick={() => fileInputRef.current?.click()}
                className="px-8 py-3.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-base shadow-sm hover:shadow transition-all inline-flex items-center gap-2.5"
              >
                <UploadCloud className="w-5 h-5" />
                <span>Upload PDF to Sign</span>
              </button>

              <div className="text-xs text-slate-500 dark:text-slate-400">
                or drop PDF here
              </div>

              <div className="pt-2">
                <button
                  onClick={handleStartBlankDocument}
                  className="text-xs text-slate-500 hover:text-emerald-600 underline font-medium transition-colors"
                >
                  or start with a blank document
                </button>
              </div>
            </div>

            <div className="pt-4 border-t border-slate-100 dark:border-slate-800 text-[11px] text-slate-400 dark:text-slate-500">
              Files stay private. Automatically deleted after 2 hours. Free service for documents up to 200 pages or 50 MB.
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl mx-auto pt-6 text-xs text-slate-600 dark:text-slate-400">
            <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-2">
              <PenTool className="w-5 h-5 text-teal-600" />
              <h4 className="font-bold text-slate-900 dark:text-white text-sm">Draw or Type Signature</h4>
              <p>Create smooth freehand signatures with your mouse/touchscreen or generate realistic cursive signatures.</p>
            </div>
            <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-2">
              <CheckSquare className="w-5 h-5 text-emerald-600" />
              <h4 className="font-bold text-slate-900 dark:text-white text-sm">Fill Forms &amp; Checkboxes</h4>
              <p>Stamp checkmarks (✓), crossmarks (✗), and type dates or names directly into PDF form fields.</p>
            </div>
            <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-2">
              <ShieldCheck className="w-5 h-5 text-indigo-600" />
              <h4 className="font-bold text-slate-900 dark:text-white text-sm">Strict Ephemeral Privacy</h4>
              <p>E-signatures are applied in-memory inside your browser. No files are retained on our servers.</p>
            </div>
          </div>
        </div>
      ) : (
        <PdfEditor file={file} onReset={() => setFile(null)} />
      )}

      {error && (
        <div className="flex items-center gap-2 p-4 rounded-xl bg-red-50 dark:bg-red-950/50 text-red-700 dark:text-red-300 text-sm border border-red-200 dark:border-red-800 max-w-xl mx-auto">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
}
