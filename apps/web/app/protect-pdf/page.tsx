'use client';

import React, { useState, useRef } from 'react';
import Link from 'next/link';
import { 
  Lock, 
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
import { protectPdfServer, downloadFileBlob } from '@/lib/api/gateway-client';

export default function ProtectPdfPage() {
  const [file, setFile] = useState<File | null>(null);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
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

  const handleProtect = async () => {
    if (!file) return;

    if (!password) {
      setError('Please choose a password.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setIsProcessing(true);
    setStatusMessage('Encrypting document with 256-bit AES encryption...');
    setError(null);

    try {
      const encryptedBlob = await protectPdfServer(file, password);
      const newName = file.name.replace('.pdf', '-protected.pdf');
      downloadFileBlob(encryptedBlob, newName);
      setStatusMessage('Success! Protected PDF downloaded.');
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Encryption failed.');
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
        <span className="text-slate-900 dark:text-white font-medium">Protect PDF</span>
      </nav>

      {/* Header */}
      <div className="text-center space-y-3">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-900 dark:bg-slate-800 text-white text-xs font-semibold">
          <KeyRound className="w-3.5 h-3.5 text-amber-400" />
          Military-Grade 256-bit AES Encryption
        </div>
        <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900 dark:text-white">
          Password Protect PDF
        </h1>
        <p className="text-sm sm:text-base text-slate-600 dark:text-slate-400 max-w-lg mx-auto">
          Encrypt your PDF with standard 256-bit AES encryption so only recipients with the password can open or view it.
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
            <div className="w-16 h-16 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-100 flex items-center justify-center group-hover:scale-110 transition-transform shadow-md">
              <UploadCloud className="w-8 h-8" />
            </div>
            <div>
              <span className="text-base font-bold text-slate-800 dark:text-slate-100">
                Click to select a PDF to password protect
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
              <FileCheck className="w-6 h-6 text-brand-600" />
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white truncate max-w-xs">{file.name}</h3>
                <p className="text-xs text-slate-400">Ready to lock with password</p>
              </div>
            </div>
            <button
              onClick={() => { setFile(null); setPassword(''); setConfirmPassword(''); }}
              className="text-xs text-red-500 hover:underline"
            >
              Change File
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1">
                Set Document Password:
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter strong password"
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-brand-500"
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

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1">
                Confirm Password:
              </label>
              <input
                type={showPassword ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Re-enter password"
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>
          </div>

          {/* Action Row */}
          <div className="pt-4 flex flex-col sm:flex-row items-center justify-between gap-4 border-t border-slate-100 dark:border-slate-800">
            <div className="text-xs text-slate-500 flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-emerald-500" />
              <span>Strict 120-minute ephemeral purge &bull; Zero permanent storage</span>
            </div>

            <button
              onClick={handleProtect}
              disabled={isProcessing}
              className="w-full sm:w-auto px-6 py-3 rounded-xl bg-slate-900 hover:bg-black dark:bg-brand-600 dark:hover:bg-brand-700 text-white font-bold text-sm shadow-lg flex items-center justify-center gap-2 transition-all"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Encrypting...</span>
                </>
              ) : (
                <>
                  <Lock className="w-4 h-4" />
                  <span>Encrypt & Download PDF</span>
                </>
              )}
            </button>
          </div>

          {statusMessage && (
            <div className="text-center text-xs font-medium text-brand-600 dark:text-brand-400 pt-2">
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
