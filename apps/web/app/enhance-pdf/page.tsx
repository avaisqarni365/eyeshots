'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { 
  Sparkles, 
  Upload, 
  Download, 
  RotateCcw, 
  ZoomIn, 
  ZoomOut, 
  CheckCircle2, 
  ShieldCheck, 
  ArrowRight, 
  Layers, 
  Sliders, 
  FileText, 
  Image as ImageIcon,
  ChevronLeft,
  ChevronRight,
  Eye,
  Loader2,
  Lock
} from 'lucide-react';
import * as pdfjsLib from 'pdfjs-dist';
import { PDFDocument } from 'pdf-lib';
import { 
  VisibilitySettings, 
  VISIBILITY_PRESETS, 
  getVisibilityCssFilter, 
  getCanvasContextFilter,
  applySharpenFilter 
} from '@/lib/pdf/visibility-enhancer';
import { downloadPdfBlob } from '@/lib/pdf/wasm-pipeline';

if (typeof window !== 'undefined') {
  pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';
}

export default function EnhancePdfPage() {
  const [file, setFile] = useState<File | null>(null);
  const [fileType, setFileType] = useState<'pdf' | 'image' | null>(null);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  // PDF navigation
  const [pdfDocProxy, setPdfDocProxy] = useState<pdfjsLib.PDFDocumentProxy | null>(null);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [totalPages, setTotalPages] = useState<number>(1);

  // Visibility Filter State
  const [settings, setSettings] = useState<VisibilitySettings>(VISIBILITY_PRESETS.magic);

  // Split-View Before / After Slider Position (0 to 100 percentage)
  const [splitPos, setSplitPos] = useState<number>(50);
  const isDraggingSplitRef = useRef<boolean>(false);

  // Canvases
  const originalCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const enhancedCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Handle file drop/upload
  const handleFileSelect = (uploadedFile: File) => {
    if (!uploadedFile) return;
    setFile(uploadedFile);
    setCurrentPage(1);

    if (uploadedFile.type === 'application/pdf' || uploadedFile.name.endsWith('.pdf')) {
      setFileType('pdf');
      loadPdf(uploadedFile);
    } else if (uploadedFile.type.startsWith('image/')) {
      setFileType('image');
      loadImage(uploadedFile);
    } else {
      setStatusMessage('Please select a valid PDF document or image file (JPG, PNG, WEBP).');
    }
  };

  // Load PDF
  const loadPdf = async (pdfFile: File) => {
    setIsProcessing(true);
    setStatusMessage('Reading PDF pages into secure browser sandbox...');
    try {
      const buffer = await pdfFile.arrayBuffer();
      const loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(buffer).slice() });
      const doc = await loadingTask.promise;
      setPdfDocProxy(doc);
      setTotalPages(doc.numPages);
      setCurrentPage(1);
      await renderPdfPage(doc, 1);
      setIsProcessing(false);
      setStatusMessage(null);
    } catch (err: any) {
      console.error(err);
      setStatusMessage('Failed to load PDF: ' + (err.message || 'Unknown error'));
      setIsProcessing(false);
    }
  };

  // Render a specific PDF page onto both original and enhanced preview canvases
  const renderPdfPage = async (doc: pdfjsLib.PDFDocumentProxy, pageNum: number) => {
    try {
      const page = await doc.getPage(pageNum);
      const viewport = page.getViewport({ scale: 1.5 });

      // Render onto Original Canvas
      if (originalCanvasRef.current) {
        originalCanvasRef.current.width = viewport.width;
        originalCanvasRef.current.height = viewport.height;
        const ctx = originalCanvasRef.current.getContext('2d');
        if (ctx) {
          await page.render({ canvasContext: ctx, viewport }).promise;
        }
      }

      // Render onto Enhanced Canvas
      if (enhancedCanvasRef.current) {
        enhancedCanvasRef.current.width = viewport.width;
        enhancedCanvasRef.current.height = viewport.height;
        const ctx = enhancedCanvasRef.current.getContext('2d');
        if (ctx) {
          await page.render({ canvasContext: ctx, viewport }).promise;
        }
      }
    } catch (e) {
      console.error('Error rendering page:', e);
    }
  };

  // Load Image
  const loadImage = (imageFile: File) => {
    setIsProcessing(true);
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const maxWidth = 1200;
        const scale = Math.min(1, maxWidth / img.width);
        const w = img.width * scale;
        const h = img.height * scale;

        if (originalCanvasRef.current) {
          originalCanvasRef.current.width = w;
          originalCanvasRef.current.height = h;
          const ctx = originalCanvasRef.current.getContext('2d');
          ctx?.drawImage(img, 0, 0, w, h);
        }

        if (enhancedCanvasRef.current) {
          enhancedCanvasRef.current.width = w;
          enhancedCanvasRef.current.height = h;
          const ctx = enhancedCanvasRef.current.getContext('2d');
          ctx?.drawImage(img, 0, 0, w, h);
        }

        setTotalPages(1);
        setIsProcessing(false);
      };
      img.src = e.target?.result as string;
    };
    reader.readAsDataURL(imageFile);
  };

  // Page change
  const changePage = (newPage: number) => {
    if (!pdfDocProxy || newPage < 1 || newPage > totalPages) return;
    setCurrentPage(newPage);
    renderPdfPage(pdfDocProxy, newPage);
  };

  // Preset switch
  const selectPreset = (presetKey: keyof typeof VISIBILITY_PRESETS) => {
    setSettings(VISIBILITY_PRESETS[presetKey]);
  };

  // Split-slider drag handlers
  const handleSplitMouseDown = (e: React.MouseEvent) => {
    isDraggingSplitRef.current = true;
    updateSplitPosition(e.clientX);
  };

  const updateSplitPosition = useCallback((clientX: number) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const pos = ((clientX - rect.left) / rect.width) * 100;
    setSplitPos(Math.min(95, Math.max(5, pos)));
  }, []);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isDraggingSplitRef.current) {
        updateSplitPosition(e.clientX);
      }
    };
    const handleMouseUp = () => {
      isDraggingSplitRef.current = false;
    };
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [updateSplitPosition]);

  // Download Enhanced PDF
  const handleDownloadEnhancedPdf = async () => {
    if (!file) return;
    setIsProcessing(true);
    setStatusMessage('Baking genuine visibility enhancements into high-resolution PDF...');

    try {
      const pdfDoc = await PDFDocument.create();

      if (fileType === 'pdf' && pdfDocProxy) {
        // Enhance each PDF page at high DPI
        for (let i = 1; i <= pdfDocProxy.numPages; i++) {
          const page = await pdfDocProxy.getPage(i);
          const viewport = page.getViewport({ scale: 2.0 }); // High-DPI 300 DPI clarity

          const offscreenCanvas = document.createElement('canvas');
          offscreenCanvas.width = viewport.width;
          offscreenCanvas.height = viewport.height;
          const ctx = offscreenCanvas.getContext('2d');

          if (ctx) {
            // Apply canvas filter
            const filterStr = getCanvasContextFilter(settings);
            if (filterStr !== 'none') {
              ctx.filter = filterStr;
            }
            await page.render({ canvasContext: ctx, viewport }).promise;

            if (settings.sharpness > 0) {
              applySharpenFilter(ctx, offscreenCanvas.width, offscreenCanvas.height, settings.sharpness);
            }

            const pngDataUrl = offscreenCanvas.toDataURL('image/png', 0.95);
            const pngBytes = await fetch(pngDataUrl).then((r) => r.arrayBuffer());
            const embeddedImg = await pdfDoc.embedPng(pngBytes);

            const { width: origWidth, height: origHeight } = page.getViewport({ scale: 1.0 });
            const newPdfPage = pdfDoc.addPage([origWidth, origHeight]);
            newPdfPage.drawImage(embeddedImg, {
              x: 0,
              y: 0,
              width: origWidth,
              height: origHeight,
            });
          }
        }
      } else if (fileType === 'image' && enhancedCanvasRef.current) {
        // Single Image Document
        const offscreenCanvas = document.createElement('canvas');
        offscreenCanvas.width = enhancedCanvasRef.current.width;
        offscreenCanvas.height = enhancedCanvasRef.current.height;
        const ctx = offscreenCanvas.getContext('2d');

        if (ctx) {
          const filterStr = getCanvasContextFilter(settings);
          if (filterStr !== 'none') {
            ctx.filter = filterStr;
          }
          ctx.drawImage(originalCanvasRef.current || enhancedCanvasRef.current, 0, 0);

          if (settings.sharpness > 0) {
            applySharpenFilter(ctx, offscreenCanvas.width, offscreenCanvas.height, settings.sharpness);
          }

          const pngDataUrl = offscreenCanvas.toDataURL('image/png', 0.95);
          const pngBytes = await fetch(pngDataUrl).then((r) => r.arrayBuffer());
          const embeddedImg = await pdfDoc.embedPng(pngBytes);

          const newPdfPage = pdfDoc.addPage([offscreenCanvas.width * 0.75, offscreenCanvas.height * 0.75]);
          newPdfPage.drawImage(embeddedImg, {
            x: 0,
            y: 0,
            width: newPdfPage.getWidth(),
            height: newPdfPage.getHeight(),
          });
        }
      }

      const pdfBytes = await pdfDoc.save();
      const newName = file.name.replace(/\.[^/.]+$/, '') + '-enhanced.pdf';
      downloadPdfBlob(pdfBytes, newName);

      setStatusMessage('Document successfully enhanced and downloaded!');
    } catch (e: any) {
      console.error(e);
      setStatusMessage('Error exporting enhanced document: ' + (e.message || 'Unknown error'));
    } finally {
      setIsProcessing(false);
    }
  };

  // Download Enhanced Image (PNG)
  const handleDownloadEnhancedImage = () => {
    if (!enhancedCanvasRef.current || !file) return;

    const offscreenCanvas = document.createElement('canvas');
    offscreenCanvas.width = enhancedCanvasRef.current.width;
    offscreenCanvas.height = enhancedCanvasRef.current.height;
    const ctx = offscreenCanvas.getContext('2d');

    if (ctx) {
      const filterStr = getCanvasContextFilter(settings);
      if (filterStr !== 'none') {
        ctx.filter = filterStr;
      }
      ctx.drawImage(originalCanvasRef.current || enhancedCanvasRef.current, 0, 0);

      if (settings.sharpness > 0) {
        applySharpenFilter(ctx, offscreenCanvas.width, offscreenCanvas.height, settings.sharpness);
      }

      const link = document.createElement('a');
      link.download = file.name.replace(/\.[^/.]+$/, '') + '-enhanced.png';
      link.href = offscreenCanvas.toDataURL('image/png', 0.95);
      link.click();
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-100 flex flex-col">
      {/* SVG Hardware Convolve Filter for Edge Sharpening */}
      <svg className="hidden">
        <filter id="genuine-sharpen">
          <feConvolveMatrix order="3" kernelMatrix="0 -0.8 0 -0.8 4.2 -0.8 0 -0.8 0" />
        </filter>
      </svg>

      {/* Hero Header */}
      <div className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 py-8 px-4 text-center">
        <div className="max-w-3xl mx-auto space-y-3">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-50 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-800/80 text-amber-700 dark:text-amber-300 text-xs font-semibold">
            <Sparkles className="w-3.5 h-3.5 text-amber-500 animate-pulse" />
            <span>AI-Free Genuine Clarity • Never Artificial • 100% Client-Side</span>
          </div>

          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-slate-900 dark:text-white">
            Enhance Document Visibility
          </h1>

          <p className="text-sm sm:text-base text-slate-600 dark:text-slate-400 max-w-2xl mx-auto">
            Clean murky shadows, yellow casts, and gray backgrounds from scans, camera photos, and receipts.
            Text becomes crisp and ink darkens, while blue/red stamps, signatures, and genuine paper texture stay 100% authentic.
          </p>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8">
        {!file ? (
          /* Upload State */
          <div className="max-w-2xl mx-auto mt-6">
            <div
              onClick={() => fileInputRef.current?.click()}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                if (e.dataTransfer.files[0]) handleFileSelect(e.dataTransfer.files[0]);
              }}
              className="border-2 border-dashed border-slate-300 dark:border-slate-700 hover:border-amber-500 dark:hover:border-amber-500 bg-white dark:bg-slate-900 rounded-3xl p-12 text-center cursor-pointer transition-all shadow-sm hover:shadow-xl group"
            >
              <div className="w-16 h-16 rounded-2xl bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform">
                <Upload className="w-8 h-8" />
              </div>
              <h3 className="text-xl font-bold text-slate-800 dark:text-white mb-2">
                Drop your document or image here
              </h3>
              <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">
                Supports PDF files, receipts, contracts, camera photos (.jpg, .png, .webp)
              </p>

              <button className="px-6 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-semibold text-sm shadow-md transition-all">
                Choose PDF or Image
              </button>

              <input
                ref={fileInputRef}
                type="file"
                accept="application/pdf,image/png,image/jpeg,image/webp"
                onChange={(e) => {
                  if (e.target.files?.[0]) handleFileSelect(e.target.files[0]);
                }}
                className="hidden"
              />
            </div>

            {/* Genuine Clarity Feature Pillars */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-8">
              <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-1">
                <div className="text-amber-600 dark:text-amber-400 font-bold text-sm flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Stays Genuine</span>
                </div>
                <p className="text-xs text-slate-500">
                  No artificial thresholding. Preserves blue ink signatures, official notary stamps, and handwritten pencil.
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-1">
                <div className="text-amber-600 dark:text-amber-400 font-bold text-sm flex items-center gap-1.5">
                  <Sliders className="w-4 h-4" />
                  <span>Shadow Cleaner</span>
                </div>
                <p className="text-xs text-slate-500">
                  Adaptive background leveling removes dirty camera angles and shadow gradients across the page.
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-1">
                <div className="text-amber-600 dark:text-amber-400 font-bold text-sm flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4" />
                  <span>100% Client-Side</span>
                </div>
                <p className="text-xs text-slate-500">
                  Zero files uploaded to any server. All contrast and brightness math executes in your local browser sandbox.
                </p>
              </div>
            </div>
          </div>
        ) : (
          /* Editor & Before/After Comparison Interface */
          <div className="space-y-6">
            {/* Top Controls Bar */}
            <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-amber-50 dark:bg-amber-950/60 text-amber-600">
                  {fileType === 'pdf' ? <FileText className="w-5 h-5" /> : <ImageIcon className="w-5 h-5" />}
                </div>
                <div>
                  <h4 className="font-bold text-sm text-slate-800 dark:text-white truncate max-w-[200px] sm:max-w-xs">
                    {file.name}
                  </h4>
                  <span className="text-xs text-slate-500">
                    {(file.size / 1024).toFixed(1)} KB • {fileType === 'pdf' ? `${totalPages} Pages` : 'Single Image'}
                  </span>
                </div>
              </div>

              {/* Multi-page controls if PDF */}
              {fileType === 'pdf' && totalPages > 1 && (
                <div className="flex items-center gap-2 text-xs font-semibold">
                  <button
                    onClick={() => changePage(currentPage - 1)}
                    disabled={currentPage <= 1}
                    className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 disabled:opacity-40 hover:bg-slate-100 dark:hover:bg-slate-800"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <span>
                    Page {currentPage} of {totalPages}
                  </span>
                  <button
                    onClick={() => changePage(currentPage + 1)}
                    disabled={currentPage >= totalPages}
                    className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 disabled:opacity-40 hover:bg-slate-100 dark:hover:bg-slate-800"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              )}

              {/* Actions */}
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    setFile(null);
                    setPdfDocProxy(null);
                  }}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  Change File
                </button>

                <button
                  onClick={handleDownloadEnhancedPdf}
                  disabled={isProcessing}
                  className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-md flex items-center gap-2 transition-all"
                >
                  {isProcessing ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Download className="w-4 h-4" />
                  )}
                  <span>Export Clean PDF</span>
                </button>

                {fileType === 'image' && (
                  <button
                    onClick={handleDownloadEnhancedImage}
                    disabled={isProcessing}
                    className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs shadow-sm flex items-center gap-1.5 transition-all"
                  >
                    <ImageIcon className="w-3.5 h-3.5" />
                    <span>Save Image</span>
                  </button>
                )}
              </div>
            </div>

            {/* Presets Row */}
            <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 border border-slate-200 dark:border-slate-800 shadow-sm space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Genuine Document Presets
                </span>
                <span className="text-[11px] text-amber-600 dark:text-amber-400 font-medium">
                  Drag the slider on the preview below to inspect before/after
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2">
                {[
                  { key: 'magic', label: 'Magic Clean', desc: 'Whitens paper, keeps stamps & signatures', icon: '✨' },
                  { key: 'ink', label: 'Darken Ink', desc: 'Deepens faint handwriting & pencil', icon: '🖋️' },
                  { key: 'sharp', label: 'Crisp & Sharp', desc: 'Cleans soft / blurry phone scans', icon: '🔍' },
                  { key: 'warm', label: 'Warm Natural', desc: 'Preserves genuine paper warmth', icon: '📜' },
                  { key: 'mono', label: 'Clean B&W', desc: 'High-contrast printout for text', icon: '🖨️' },
                  { key: 'original', label: 'Original Scan', desc: 'Reset all filters', icon: '🔄' },
                ].map((p) => {
                  const isActive = settings.preset === p.key;
                  return (
                    <button
                      key={p.key}
                      onClick={() => selectPreset(p.key as any)}
                      className={`p-3 rounded-xl border text-left transition-all flex flex-col justify-between ${
                        isActive
                          ? 'border-amber-500 bg-amber-50/70 dark:bg-amber-950/40 ring-2 ring-amber-400 shadow-sm'
                          : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 bg-slate-50/50 dark:bg-slate-800/40'
                      }`}
                    >
                      <div className="flex items-center gap-1.5 font-bold text-xs text-slate-800 dark:text-white">
                        <span>{p.icon}</span>
                        <span>{p.label}</span>
                      </div>
                      <span className="text-[10px] text-slate-500 dark:text-slate-400 mt-1 line-clamp-2">
                        {p.desc}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Fine-Tuning Sliders Accordion */}
              <div className="pt-3 border-t border-slate-100 dark:border-slate-800 grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
                {/* Paper White Level (Brightness) */}
                <div className="space-y-1">
                  <div className="flex justify-between font-medium text-slate-600 dark:text-slate-300">
                    <span>Paper White Level (Shadow Removal):</span>
                    <span className="font-bold text-amber-600">{settings.brightness}%</span>
                  </div>
                  <input
                    type="range"
                    min="80"
                    max="150"
                    value={settings.brightness}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        preset: 'custom',
                        brightness: parseInt(e.target.value, 10),
                      })
                    }
                    className="w-full accent-amber-500"
                  />
                </div>

                {/* Ink Contrast */}
                <div className="space-y-1">
                  <div className="flex justify-between font-medium text-slate-600 dark:text-slate-300">
                    <span>Ink Depth & Contrast:</span>
                    <span className="font-bold text-amber-600">{settings.contrast}%</span>
                  </div>
                  <input
                    type="range"
                    min="100"
                    max="220"
                    value={settings.contrast}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        preset: 'custom',
                        contrast: parseInt(e.target.value, 10),
                      })
                    }
                    className="w-full accent-amber-500"
                  />
                </div>

                {/* Sharpness */}
                <div className="space-y-1">
                  <div className="flex justify-between font-medium text-slate-600 dark:text-slate-300">
                    <span>Edge Micro-Contrast (Sharpness):</span>
                    <span className="font-bold text-amber-600">{settings.sharpness}%</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={settings.sharpness}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        preset: 'custom',
                        sharpness: parseInt(e.target.value, 10),
                      })
                    }
                    className="w-full accent-amber-500"
                  />
                </div>
              </div>
            </div>

            {/* 🔍 Interactive Before & After Split-Slider Preview Area */}
            <div className="flex flex-col items-center space-y-2">
              <div className="flex items-center justify-between w-full max-w-4xl px-2 text-xs text-slate-500">
                <span className="font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1">
                  ◀ ORIGINAL SCAN
                </span>
                <span className="text-[11px] bg-slate-200 dark:bg-slate-800 px-2 py-0.5 rounded-full font-medium">
                  Drag central divider to compare
                </span>
                <span className="font-semibold text-amber-600 dark:text-amber-400 flex items-center gap-1">
                  GENUINE ENHANCED ▶
                </span>
              </div>

              {/* Split Canvas Container */}
              <div
                ref={containerRef}
                className="relative bg-white shadow-2xl rounded-xl border border-slate-300 dark:border-slate-700 overflow-hidden select-none cursor-ew-resize max-w-4xl w-full flex justify-center"
                style={{ minHeight: '500px' }}
                onMouseDown={handleSplitMouseDown}
              >
                {/* 1. Base Layer: Enhanced Version (Full Width with CSS / SVG filter) */}
                <div className="relative">
                  <canvas
                    ref={enhancedCanvasRef}
                    className="block"
                    style={{
                      filter: getVisibilityCssFilter(settings),
                    }}
                  />

                  {/* 2. Overlaid Clip: Original Version clipped to splitPos */}
                  <div
                    className="absolute top-0 left-0 h-full overflow-hidden border-r-2 border-amber-500 shadow-2xl pointer-events-none"
                    style={{
                      width: `${splitPos}%`,
                    }}
                  >
                    <canvas
                      ref={originalCanvasRef}
                      className="block"
                      style={{ filter: 'none' }}
                    />
                  </div>

                  {/* 3. Draggable Split Divider Line & Handle */}
                  <div
                    className="absolute top-0 bottom-0 pointer-events-none"
                    style={{ left: `${splitPos}%`, transform: 'translateX(-50%)' }}
                  >
                    <div className="w-0.5 h-full bg-amber-500 shadow-lg" />
                    <div className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 left-1/2 w-8 h-8 rounded-full bg-amber-500 text-white shadow-xl flex items-center justify-center font-bold text-[10px]">
                      VS
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Ephemeral Privacy Trust Footer */}
      <div className="bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 py-4 px-6 text-center text-xs text-slate-500">
        <div className="max-w-4xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Lock className="w-3.5 h-3.5 text-emerald-500" />
            <span>Files are processed locally inside your web browser. Nothing is stored on any server.</span>
          </div>
          <span>EyeShots Document Privacy Standard</span>
        </div>
      </div>
    </div>
  );
}
