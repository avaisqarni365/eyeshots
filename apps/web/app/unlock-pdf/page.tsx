'use client';

import React, { useState, useRef } from 'react';
import Link from 'next/link';
import { 
  Unlock, 
  UploadCloud, 
  Download, 
  ShieldCheck, 
  AlertCircle, 
  Loader2, 
  ChevronRight, 
  FileCheck,
  KeyRound,
  Eye,
  EyeOff
} from 'lucide-react';
import { unlockPdfServer, downloadFileBlob } from '@/lib/api/gateway-client';

export default function UnlockPdfPage() {
  const [file, setFile] = useState<File | null>(null);
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
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

  const handleUnlock = async () => {
    if (!file) return;

    if (!password) {
      setError('Please enter the document password to unlock it.');
      return;
    }

    setIsProcessing(true);
    setStatusMessage('Stripping security permissions and decrypting streams...');
    setError(null);

    try {
      const unlockedBlob = await unlockPdfServer(file, password);
      const newName = file.name.replace('.pdf', '-unlocked.pdf');
      downloadFileBlob(unlockedBlob, newName);
      setStatusMessage('Success! Unlocked PDF downloaded.');
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Incorrect password or failed to unlock document.');
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
        <span className="text-slate-900 dark:text-white font-medium">Unlock PDF</span>
      </nav>

      {/* Header */}
      <div className="text-center space-y-3">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 text-xs font-semibold border border-emerald-200 dark:border-emerald-800/60">
          <KeyRound className="w-3.5 h-3.5 text-emerald-500" />
          Remove Password Restrictions &bull; Strip Encryption
        </div>
        <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900 dark:text-white">
          Unlock Password-Protected PDF
        </h1>
        <p className="text-sm sm:text-base text-slate-600 dark:text-slate-400 max-w-lg mx-auto">
          Remove password security and printing/editing restrictions so you can access your document freely without entering passwords again.
        </p>
      </div>

      {!file ? (
        <div
          onClick={() => fileInputRef.current?.click()}
          className="group relative border-2 border-dashed border-slate-300 dark:border-slate-700 hover:border-emerald-500 rounded-3xl p-10 sm:p-14 text-center cursor-pointer bg-white/70 dark:bg-slate-900/70 hover:bg-emerald-50/30 dark:hover:bg-emerald-950/20 transition-all shadow-sm"
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,application/pdf"
            onChange={handleFileSelect}
            className="hidden"
          />

          <div className="flex flex-col items-center gap-3">
            <div className="w-16 h-16 rounded-2xl bg-emerald-50 dark:bg-emerald-950/80 text-emerald-600 dark:text-emerald-400 flex items-center justify-center group-hover:scale-110 transition-transform shadow-md shadow-emerald-500/10">
              <UploadCloud className="w-8 h-8" />
            </div>
            <div>
              <span className="text-base font-bold text-slate-800 dark:text-slate-100">
                Click to select a locked PDF
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
              <FileCheck className="w-6 h-6 text-emerald-600" />
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white truncate max-w-xs">{file.name}</h3>
                <p className="text-xs text-slate-400">Locked PDF Document</p>
              </div>
            </div>
            <button
              onClick={() => { setFile(null); setPassword(''); }}
              className="text-xs text-red-500 hover:underline"
            >
              Change File
            </button>
          </div>

          <div className="max-w-md">
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1">
              Enter Document Password:
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter password to unlock"
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-3 text-slate-400 hover:text-slate-600"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Action Row */}
          <div className="pt-4 flex flex-col sm:flex-row items-center justify-between gap-4 border-t border-slate-100 dark:border-slate-800">
            <div className="text-xs text-slate-500 flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-emerald-500" />
              <span>Strict 120-minute ephemeral purge &bull; Zero permanent storage</span>
            </div>

            <button
              onClick={handleUnlock}
              disabled={isProcessing}
              className="w-full sm:w-auto px-6 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm shadow-lg shadow-emerald-500/20 flex items-center justify-center gap-2 transition-all"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Unlocking...</span>
                </>
              ) : (
                <>
                  <Unlock className="w-4 h-4" />
                  <span>Remove Password & Download</span>
                </>
              )}
            </button>
          </div>

          {statusMessage && (
            <div className="text-center text-xs font-medium text-emerald-600 dark:text-emerald-400 pt-2">
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
