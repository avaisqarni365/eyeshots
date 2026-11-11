'use client';

import React, { useState, useRef } from 'react';
import Link from 'next/link';
import { 
  Stamp, 
  UploadCloud, 
  Download, 
  ShieldCheck, 
  Zap, 
  AlertCircle, 
  Loader2, 
  ChevronRight, 
  FileCheck,
  Sliders,
  Type
} from 'lucide-react';
import { watermarkPdfClient, downloadPdfBlob, WatermarkOptions } from '@/lib/pdf/wasm-pipeline';
import { PDFDocument } from 'pdf-lib';

export default function WatermarkPdfPage() {
  const [file, setFile] = useState<File | null>(null);
  const [watermarkText, setWatermarkText] = useState('CONFIDENTIAL');
  const [fontSize, setFontSize] = useState(48);
  const [opacity, setOpacity] = useState(0.3);
  const [rotation, setRotation] = useState(45);
  const [colorPreset, setColorPreset] = useState<'gray' | 'red' | 'blue'>('gray');
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const COLOR_MAP = {
    gray: { r: 0.5, g: 0.5, b: 0.5 },
    red: { r: 0.85, g: 0.15, b: 0.15 },
    blue: { r: 0.15, g: 0.35, b: 0.85 },
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const selected = e.target.files[0];
    
    if (!selected.name.endsWith('.pdf')) {
      setError('Please select a valid PDF file.');
      return;
    }

    setFile(selected);
    setError(null);
  };

  const handleApplyWatermark = async () => {
    if (!file || !watermarkText.trim()) {
      setError('Please enter watermark text.');
      return;
    }

    setIsProcessing(true);
    setError(null);

    try {
      const buffer = await file.arrayBuffer();
      const options: WatermarkOptions = {
        text: watermarkText.trim(),
        fontSize,
        opacity,
        rotation,
        color: COLOR_MAP[colorPreset],
      };

      const watermarkedBytes = await watermarkPdfClient(buffer, options);
      const newName = file.name.replace('.pdf', '-watermarked.pdf');
      downloadPdfBlob(watermarkedBytes, newName);
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Failed to watermark PDF.');
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
        <span className="text-slate-900 dark:text-white font-medium">Watermark PDF</span>
      </nav>

      {/* Header */}
      <div className="text-center space-y-3">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 text-xs font-semibold border border-emerald-200 dark:border-emerald-800/60">
          <Zap className="w-3.5 h-3.5 text-amber-500" />
          100% Client-Side WebAssembly &bull; Instant Watermarking
        </div>
        <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900 dark:text-white">
          Add Watermark to PDF
        </h1>
        <p className="text-sm sm:text-base text-slate-600 dark:text-slate-400 max-w-lg mx-auto">
          Stamp diagonal text, confidentiality notices, or copyright marks across every page of your PDF.
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
                Click to select a PDF to watermark
              </span>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Zero server upload. Processed right in your browser.
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
                <p className="text-xs text-slate-400">Ready to watermark</p>
              </div>
            </div>
            <button
              onClick={() => setFile(null)}
              className="text-xs text-red-500 hover:underline"
            >
              Change File
            </button>
          </div>

          {/* Controls */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1">
                  Watermark Text
                </label>
                <input
                  type="text"
                  value={watermarkText}
                  onChange={(e) => setWatermarkText(e.target.value)}
                  placeholder="e.g. CONFIDENTIAL, DRAFT"
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>

              <div>
                <div className="flex justify-between text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  <span>Font Size</span>
                  <span>{fontSize}px</span>
                </div>
                <input
                  type="range"
                  min="20"
                  max="90"
                  value={fontSize}
                  onChange={(e) => setFontSize(parseInt(e.target.value, 10))}
                  className="w-full accent-brand-600"
                />
              </div>

              <div>
                <div className="flex justify-between text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  <span>Transparency (Opacity)</span>
                  <span>{Math.round(opacity * 100)}%</span>
                </div>
                <input
                  type="range"
                  min="0.1"
                  max="0.9"
                  step="0.05"
                  value={opacity}
                  onChange={(e) => setOpacity(parseFloat(e.target.value))}
                  className="w-full accent-brand-600"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-2">
                  Angle & Color
                </label>
                <div className="flex items-center gap-3">
                  <select
                    value={rotation}
                    onChange={(e) => setRotation(parseInt(e.target.value, 10))}
                    className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-semibold focus:outline-none"
                  >
                    <option value={45}>45° Diagonal</option>
                    <option value={0}>0° Horizontal</option>
                    <option value={90}>90° Vertical</option>
                    <option value={-45}>-45° Diagonal</option>
                  </select>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setColorPreset('gray')}
                      className={`w-7 h-7 rounded-full bg-slate-400 border-2 ${colorPreset === 'gray' ? 'border-brand-600 ring-2 ring-brand-500/30' : 'border-transparent'}`}
                      title="Gray"
                    />
                    <button
                      onClick={() => setColorPreset('red')}
                      className={`w-7 h-7 rounded-full bg-red-500 border-2 ${colorPreset === 'red' ? 'border-brand-600 ring-2 ring-brand-500/30' : 'border-transparent'}`}
                      title="Red"
                    />
                    <button
                      onClick={() => setColorPreset('blue')}
                      className={`w-7 h-7 rounded-full bg-blue-600 border-2 ${colorPreset === 'blue' ? 'border-brand-600 ring-2 ring-brand-500/30' : 'border-transparent'}`}
                      title="Blue"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Live Visual Preview Canvas */}
            <div className="flex flex-col items-center justify-center p-6 rounded-2xl bg-slate-100 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-3">Live Stamp Preview</span>
              <div className="w-48 aspect-[3/4] bg-white dark:bg-slate-900 rounded-lg shadow-md border border-slate-200 dark:border-slate-700 flex items-center justify-center relative overflow-hidden p-2 text-center">
                <div 
                  style={{ 
                    transform: `rotate(${rotation}deg)`,
                    opacity: opacity,
                    fontSize: `${fontSize * 0.4}px`,
                    color: colorPreset === 'red' ? '#dc2626' : colorPreset === 'blue' ? '#2563eb' : '#6b7280'
                  }}
                  className="font-extrabold uppercase tracking-widest select-none pointer-events-none transition-all duration-200"
                >
                  {watermarkText || 'SAMPLE'}
                </div>
              </div>
            </div>
          </div>

          {/* Action Row */}
          <div className="pt-4 flex flex-col sm:flex-row items-center justify-between gap-4 border-t border-slate-100 dark:border-slate-800">
            <div className="text-xs text-slate-500 flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-emerald-500" />
              <span>Processed locally in your browser &bull; Zero server egress</span>
            </div>

            <button
              onClick={handleApplyWatermark}
              disabled={isProcessing}
              className="w-full sm:w-auto px-6 py-3 rounded-xl bg-brand-600 hover:bg-brand-700 text-white font-bold text-sm shadow-lg shadow-brand-500/20 flex items-center justify-center gap-2 transition-all"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Stamping Watermark...</span>
                </>
              ) : (
                <>
                  <Stamp className="w-4 h-4" />
                  <span>Apply & Download PDF</span>
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
