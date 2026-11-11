'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { 
  Languages, 
  UploadCloud, 
  Download, 
  ShieldCheck, 
  Sparkles, 
  ChevronRight, 
  ChevronLeft,
  FileText, 
  Eye, 
  Copy, 
  Check, 
  Volume2, 
  RotateCw, 
  SlidersHorizontal, 
  ArrowLeftRight, 
  CheckCircle2, 
  Loader2, 
  FileCode, 
  Briefcase, 
  RefreshCw, 
  Split, 
  Edit3, 
  BookOpen, 
  FileDown, 
  FileCheck2,
  AlertCircle,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Table,
  Layers,
  LayoutGrid
} from 'lucide-react';
import { FileDropzone } from '@/components/FileDropzone';
import { 
  SUPPORTED_LANGUAGES, 
  SupportedLanguage, 
  TranslatedParagraph, 
  extractParagraphsFromPdfPage, 
  translateTextRealtime, 
  exportBilingualPdf, 
  generateSamplePdfBytes,
  SAMPLE_SPACE_DOCS 
} from '@/lib/pdf/translation-engine';
import * as pdfjsLib from 'pdfjs-dist';

if (typeof window !== 'undefined') {
  pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';
}

export type ViewMode = 'table_1to1' | 'visual_split';

export default function PdfSpacePage() {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [pdfDoc, setPdfDoc] = useState<pdfjsLib.PDFDocumentProxy | null>(null);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [numPages, setNumPages] = useState<number>(1);
  const [zoomScale, setZoomScale] = useState<number>(1.2);
  const [viewMode, setViewMode] = useState<ViewMode>('table_1to1');
  const [isLoadingPage, setIsLoadingPage] = useState<boolean>(false);

  // Translation configuration
  const [sourceLang, setSourceLang] = useState<string>('de');
  const [targetLang, setTargetLang] = useState<string>('en');
  const [isAutoDetect, setIsAutoDetect] = useState<boolean>(true);
  const [isTranslatingAll, setIsTranslatingAll] = useState<boolean>(false);
  const [syncScroll, setSyncScroll] = useState<boolean>(true);
  const [activeSplitRatio, setActiveSplitRatio] = useState<'50-50' | '40-60' | '60-40'>('50-50');

  // Paragraphs & Active Synchronized Focus
  const [paragraphs, setParagraphs] = useState<TranslatedParagraph[]>([]);
  const [highlightedParaId, setHighlightedParaId] = useState<string | null>(null);
  const [editingParaId, setEditingParaId] = useState<string | null>(null);
  const [editInputText, setEditInputText] = useState<string>('');

  // UI State
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [speakingId, setSpeakingId] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState<boolean>(false);

  // References
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const leftPaneRef = useRef<HTMLDivElement>(null);
  const rightPaneRef = useRef<HTMLDivElement>(null);
  const isScrollingSyncRef = useRef<boolean>(false);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3200);
  };

  const currentTargetLangObj = SUPPORTED_LANGUAGES.find((l) => l.code === targetLang) || SUPPORTED_LANGUAGES[0];

  // Render PDF Page to Canvas with high resolution
  const renderCanvasPage = useCallback(async (doc: pdfjsLib.PDFDocumentProxy, pageNum: number, scale: number) => {
    try {
      setIsLoadingPage(true);
      const page = await doc.getPage(pageNum);
      const viewport = page.getViewport({ scale });

      const canvas = canvasRef.current;
      if (!canvas) return;

      canvas.width = viewport.width;
      canvas.height = viewport.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      await page.render({ canvasContext: ctx, viewport }).promise;
    } catch (err) {
      console.error('Canvas render error:', err);
    } finally {
      setIsLoadingPage(false);
    }
  }, []);

  // Extract and Translate page content
  const loadPageContent = useCallback(async (doc: pdfjsLib.PDFDocumentProxy, pageNum: number) => {
    try {
      const extracted = await extractParagraphsFromPdfPage(doc, pageNum);
      if (extracted.length === 0) {
        // Fallback for scans without text layer
        extracted.push({
          id: `p_${pageNum}_0`,
          pageNumber: pageNum,
          paragraphIndex: 1,
          sourceText: `[Page ${pageNum}] Document page rendered. No digital text stream detected. You can use our OCR tool or edit text manually.`,
          translatedText: `[Page ${pageNum}] Dokumentenseite gerendert. Kein digitaler Textstrom erkannt.`,
          isTranslating: false,
          isUserEdited: false,
          confidence: 0.8,
          engineUsed: 'open-neural',
        });
      }
      setParagraphs(extracted);
      translateAllParagraphs(extracted, sourceLang, targetLang);
    } catch (err) {
      console.error('Error extracting page text:', err);
    }
  }, [sourceLang, targetLang]);

  // Load User Uploaded PDF Document
  const loadPdfDocument = async (pdfFile: File) => {
    setFile(pdfFile);
    try {
      const buffer = await pdfFile.arrayBuffer();
      const loadingTask = pdfjsLib.getDocument({
        data: new Uint8Array(buffer).slice(),
        cMapUrl: '/pdfjs/cmaps/',
        cMapPacked: true,
      });

      const doc = await loadingTask.promise;
      setPdfDoc(doc);
      setNumPages(doc.numPages);
      setCurrentPage(1);

      await loadPageContent(doc, 1);
      await renderCanvasPage(doc, 1, zoomScale);

      showToast(`Loaded "${pdfFile.name}" (${doc.numPages} page${doc.numPages > 1 ? 's' : ''})`);
    } catch (err: any) {
      console.error('Failed to load PDF in PDF Space:', err);
      showToast('Error reading PDF: ' + (err.message || 'Check file format'));
    }
  };

  // Load Built-in Realistic Sample Document (with actual generated vector PDF bytes!)
  const handleLoadSample = async (sampleId: string) => {
    const sample = SAMPLE_SPACE_DOCS.find((s) => s.id === sampleId);
    if (!sample) return;

    try {
      showToast(`Generating genuine vector PDF for ${sample.title}...`);
      const pdfBytes = await generateSamplePdfBytes(sampleId);
      const sampleBlob = new Blob([pdfBytes as any], { type: 'application/pdf' });
      const sampleFile = new File([sampleBlob], `${sample.title}.pdf`, { type: 'application/pdf' });

      setFile(sampleFile);
      setSourceLang(sample.sourceLang);
      setTargetLang(sample.targetLang);

      const loadingTask = pdfjsLib.getDocument({
        data: new Uint8Array(pdfBytes).slice(),
        cMapUrl: '/pdfjs/cmaps/',
        cMapPacked: true,
      });

      const doc = await loadingTask.promise;
      setPdfDoc(doc);
      setNumPages(doc.numPages);
      setCurrentPage(1);

      const paras: TranslatedParagraph[] = sample.paragraphs.map((p, idx) => ({
        id: `sample_p_${idx}`,
        pageNumber: 1,
        paragraphIndex: idx + 1,
        sourceText: p.sourceText,
        translatedText: p.translatedText,
        isTranslating: false,
        isUserEdited: false,
        confidence: 0.99,
        engineUsed: 'open-neural',
      }));

      setParagraphs(paras);
      await renderCanvasPage(doc, 1, zoomScale);
      showToast(`Loaded ${sample.title} with high-fidelity side-by-side sync!`);
    } catch (err: any) {
      console.error('Error generating sample:', err);
      showToast('Sample generation error: ' + err.message);
    }
  };

  // Switch to specific page
  const handlePageChange = async (newPage: number) => {
    if (!pdfDoc || newPage < 1 || newPage > numPages) return;
    setCurrentPage(newPage);
    await loadPageContent(pdfDoc, newPage);
    await renderCanvasPage(pdfDoc, newPage, zoomScale);
    showToast(`Navigated to Page ${newPage} of ${numPages}`);
  };

  // Zoom handlers
  const handleZoom = async (delta: number) => {
    const nextScale = Math.min(2.5, Math.max(0.6, Math.round((zoomScale + delta) * 10) / 10));
    setZoomScale(nextScale);
    if (pdfDoc) {
      await renderCanvasPage(pdfDoc, currentPage, nextScale);
    }
  };

  // Re-render canvas when switching to visual mode
  useEffect(() => {
    if (viewMode === 'visual_split' && pdfDoc) {
      renderCanvasPage(pdfDoc, currentPage, zoomScale);
    }
  }, [viewMode, pdfDoc, currentPage, zoomScale, renderCanvasPage]);

  // Translate all paragraphs for active view
  const translateAllParagraphs = async (
    parasToTranslate: TranslatedParagraph[],
    src: string,
    tgt: string
  ) => {
    setIsTranslatingAll(true);
    const updated = [...parasToTranslate];

    for (let i = 0; i < updated.length; i++) {
      const p = updated[i];
      if (p.isUserEdited && p.translatedText) continue;

      p.isTranslating = true;
      setParagraphs([...updated]);

      try {
        const result = await translateTextRealtime(p.sourceText, src, tgt);
        p.translatedText = result;
      } catch {
        p.translatedText = `[${tgt.toUpperCase()}] ${p.sourceText}`;
      } finally {
        p.isTranslating = false;
        setParagraphs([...updated]);
      }
    }
    setIsTranslatingAll(false);
  };

  // Change Target Language
  const handleTargetLanguageChange = (newTarget: string) => {
    setTargetLang(newTarget);
    if (paragraphs.length > 0) {
      translateAllParagraphs(paragraphs, sourceLang, newTarget);
      showToast(`Real-time translating to ${SUPPORTED_LANGUAGES.find((l) => l.code === newTarget)?.name}...`);
    }
  };

  // Swap Languages
  const handleSwapLanguages = () => {
    const prevSrc = sourceLang;
    const prevTgt = targetLang;
    setSourceLang(prevTgt);
    setTargetLang(prevSrc);
    if (paragraphs.length > 0) {
      const inverted = paragraphs.map((p) => ({
        ...p,
        sourceText: p.translatedText || p.sourceText,
        translatedText: '',
      }));
      setParagraphs(inverted);
      translateAllParagraphs(inverted, prevTgt, prevSrc);
    }
  };

  // Audio Speech Pronunciation
  const handleSpeak = (text: string, langCode: string, id: string) => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      showToast('Speech synthesis not supported in this browser.');
      return;
    }

    window.speechSynthesis.cancel();
    if (speakingId === id) {
      setSpeakingId(null);
      return;
    }

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = langCode === 'en' ? 'en-US' : langCode === 'de' ? 'de-DE' : langCode;
    utterance.rate = 0.95;
    utterance.onend = () => setSpeakingId(null);
    utterance.onerror = () => setSpeakingId(null);

    setSpeakingId(id);
    window.speechSynthesis.speak(utterance);
  };

  // Synchronized Scrolling
  const handleLeftScroll = () => {
    if (!syncScroll || isScrollingSyncRef.current) return;
    if (!leftPaneRef.current || !rightPaneRef.current) return;

    isScrollingSyncRef.current = true;
    const leftPercentage =
      leftPaneRef.current.scrollTop /
      (leftPaneRef.current.scrollHeight - leftPaneRef.current.clientHeight || 1);
    rightPaneRef.current.scrollTop =
      leftPercentage * (rightPaneRef.current.scrollHeight - rightPaneRef.current.clientHeight);

    setTimeout(() => {
      isScrollingSyncRef.current = false;
    }, 50);
  };

  const handleRightScroll = () => {
    if (!syncScroll || isScrollingSyncRef.current) return;
    if (!leftPaneRef.current || !rightPaneRef.current) return;

    isScrollingSyncRef.current = true;
    const rightPercentage =
      rightPaneRef.current.scrollTop /
      (rightPaneRef.current.scrollHeight - rightPaneRef.current.clientHeight || 1);
    leftPaneRef.current.scrollTop =
      rightPercentage * (leftPaneRef.current.scrollHeight - leftPaneRef.current.clientHeight);

    setTimeout(() => {
      isScrollingSyncRef.current = false;
    }, 50);
  };

  // In-Place Translation Edit
  const handleSaveEdit = (paraId: string) => {
    setParagraphs(
      paragraphs.map((p) =>
        p.id === paraId
          ? { ...p, translatedText: editInputText, isUserEdited: true }
          : p
      )
    );
    setEditingParaId(null);
    showToast('Translation updated.');
  };

  // Export Dual-Language Bilingual PDF
  const handleExportBilingualPdf = async () => {
    if (paragraphs.length === 0) return;
    setIsExporting(true);
    showToast('Generating side-by-side bilingual PDF...');

    try {
      const pdfBytes = await exportBilingualPdf(
        file?.name || 'Document.pdf',
        paragraphs,
        sourceLang,
        targetLang
      );
      const blob = new Blob([pdfBytes as any], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${file?.name?.replace(/\.pdf$/i, '') || 'Document'}_Bilingual_${sourceLang}_${targetLang}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      showToast('Bilingual PDF successfully generated & downloaded!');
    } catch (err: any) {
      console.error('Export error:', err);
      showToast('Export failed: ' + (err.message || 'Check document'));
    } finally {
      setIsExporting(false);
    }
  };

  // Push to Central DMS
  const handlePushToDms = () => {
    if (typeof window === 'undefined') return;
    const pendingDoc = {
      name: `${file?.name?.replace(/\.pdf$/i, '') || 'Document'}_Translated_${targetLang}.pdf`,
      sizeBytes: 420000,
      projectId: 'proj_jobcenter',
    };
    localStorage.setItem('eyeshots_pending_dms_doc', JSON.stringify(pendingDoc));
    showToast('Translation pushed to DMS workspace. Opening Central DMS...');
    setTimeout(() => router.push('/dms'), 400);
  };

  return (
    <div className="max-w-[1600px] mx-auto px-4 sm:px-6 py-6 space-y-4 select-none">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-900 text-white px-4 py-2.5 rounded-2xl shadow-2xl border border-slate-700 text-xs font-semibold flex items-center gap-2 animate-bounce">
          <Sparkles className="w-4 h-4 text-emerald-400" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Breadcrumb Navigation */}
      <nav className="flex items-center gap-2 text-xs text-slate-500">
        <Link href="/" className="hover:text-emerald-600 transition-colors">Home</Link>
        <ChevronRight className="w-3.5 h-3.5" />
        <Link href="/dms" className="hover:text-emerald-600 transition-colors">DMS</Link>
        <ChevronRight className="w-3.5 h-3.5" />
        <span className="text-slate-900 dark:text-white font-semibold">PDF Space & Real-Time Translator</span>
      </nav>

      {/* Header Toolbar */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-4 sm:p-5 shadow-sm space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-3 border-b border-slate-100 dark:border-slate-800">
          <div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 text-xs font-semibold border border-emerald-200 dark:border-emerald-800/60 mb-1.5">
              <Languages className="w-3.5 h-3.5 text-emerald-600" />
              <span>Real-Time One-to-One Alignment &bull; Open-Source Translation Engine &bull; 100% In-Browser</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
              <span>PDF Space: One-to-One Bilingual Translator</span>
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 max-w-2xl mt-0.5">
              Read and translate any PDF side-by-side with locked 1-to-1 paragraph alignment, real-time streaming, and native vector canvas rendering.
            </p>
          </div>

          {/* Quick Document Actions */}
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={handleExportBilingualPdf}
              disabled={paragraphs.length === 0 || isExporting}
              className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white font-bold text-xs flex items-center gap-2 shadow-sm transition-all"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export Bilingual PDF</span>
            </button>

            <button
              onClick={handlePushToDms}
              disabled={paragraphs.length === 0}
              className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 text-slate-700 dark:text-slate-200 font-semibold text-xs flex items-center gap-1.5 transition-all"
            >
              <Briefcase className="w-3.5 h-3.5 text-emerald-600" />
              <span>Push to DMS</span>
            </button>
          </div>
        </div>

        {/* Translation & Viewport Controls Ribbon */}
        <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
          {/* Languages Selector */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Languages:</span>

            {/* Source Language */}
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-semibold text-slate-700 dark:text-slate-200">
              <span>{SUPPORTED_LANGUAGES.find((l) => l.code === sourceLang)?.flag}</span>
              <span>{SUPPORTED_LANGUAGES.find((l) => l.code === sourceLang)?.name}</span>
              {isAutoDetect && (
                <span className="text-[9px] px-1.5 py-0.2 rounded bg-emerald-100 text-emerald-800 dark:bg-emerald-950 font-bold uppercase">Auto</span>
              )}
            </div>

            {/* Swap Button */}
            <button
              onClick={handleSwapLanguages}
              className="p-1.5 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-emerald-50 text-slate-600 hover:text-emerald-600 transition-colors"
              title="Swap Languages"
            >
              <ArrowLeftRight className="w-3.5 h-3.5" />
            </button>

            {/* Target Language Dropdown */}
            <div className="relative">
              <select
                value={targetLang}
                onChange={(e) => handleTargetLanguageChange(e.target.value)}
                className="px-3 py-1.5 rounded-xl border border-emerald-500/80 bg-emerald-50/50 dark:bg-slate-800 font-bold text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer text-xs"
              >
                {SUPPORTED_LANGUAGES.map((lang) => (
                  <option key={lang.code} value={lang.code}>
                    {lang.flag} {lang.name} ({lang.nativeName})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* View Modes & Page Controls */}
          <div className="flex items-center gap-3 flex-wrap">
            {/* View Mode Toggle */}
            <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-0.5 rounded-xl text-xs font-semibold">
              <button
                onClick={() => setViewMode('table_1to1')}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-lg transition-all ${
                  viewMode === 'table_1to1'
                    ? 'bg-white dark:bg-slate-700 text-emerald-600 shadow-sm font-bold'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                <Table className="w-3.5 h-3.5" />
                <span>1-to-1 Aligned Table</span>
              </button>

              <button
                onClick={() => setViewMode('visual_split')}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-lg transition-all ${
                  viewMode === 'visual_split'
                    ? 'bg-white dark:bg-slate-700 text-emerald-600 shadow-sm font-bold'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                <Eye className="w-3.5 h-3.5" />
                <span>Visual Canvas & Stream</span>
              </button>
            </div>

            {/* Page Navigation Switcher */}
            {numPages > 1 && (
              <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded-xl">
                <button
                  onClick={() => handlePageChange(currentPage - 1)}
                  disabled={currentPage <= 1 || isLoadingPage}
                  className="p-1 hover:bg-white dark:hover:bg-slate-700 rounded disabled:opacity-30 text-slate-600"
                  title="Previous Page"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                </button>

                <span className="text-[11px] font-mono font-bold text-slate-700 dark:text-slate-200 px-1">
                  Page {currentPage} / {numPages}
                </span>

                <button
                  onClick={() => handlePageChange(currentPage + 1)}
                  disabled={currentPage >= numPages || isLoadingPage}
                  className="p-1 hover:bg-white dark:hover:bg-slate-700 rounded disabled:opacity-30 text-slate-600"
                  title="Next Page"
                >
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            {/* Zoom Controls (Active in visual mode) */}
            {viewMode === 'visual_split' && (
              <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-0.5 rounded-xl">
                <button
                  onClick={() => handleZoom(-0.2)}
                  className="p-1 hover:bg-white dark:hover:bg-slate-700 rounded text-slate-600"
                  title="Zoom Out"
                >
                  <ZoomOut className="w-3.5 h-3.5" />
                </button>
                <span className="text-[10px] font-mono px-1 text-slate-600">{Math.round(zoomScale * 100)}%</span>
                <button
                  onClick={() => handleZoom(0.2)}
                  className="p-1 hover:bg-white dark:hover:bg-slate-700 rounded text-slate-600"
                  title="Zoom In"
                >
                  <ZoomIn className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            {/* Sync Scroll Toggle */}
            <button
              onClick={() => setSyncScroll((prev) => !prev)}
              className={`px-2.5 py-1.5 rounded-xl font-bold flex items-center gap-1.5 transition-all text-xs border ${
                syncScroll
                  ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300'
                  : 'border-slate-200 dark:border-slate-700 text-slate-500'
              }`}
            >
              <Split className="w-3.5 h-3.5" />
              <span>Sync: {syncScroll ? 'ON' : 'OFF'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Preset Built-in Sample Documents Strip */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-3 shadow-sm flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2 font-bold text-slate-700 dark:text-slate-200">
          <Sparkles className="w-4 h-4 text-emerald-600" />
          <span>Try Instant Real Bilingual Samples:</span>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {SAMPLE_SPACE_DOCS.map((sample) => (
            <button
              key={sample.id}
              onClick={() => handleLoadSample(sample.id)}
              className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 hover:border-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 text-slate-700 dark:text-slate-300 font-semibold transition-all flex items-center gap-1.5"
            >
              <span>{sample.title}</span>
              <span className="text-[10px] text-emerald-600 font-bold px-1.5 py-0.2 rounded bg-emerald-50 dark:bg-emerald-950">1-Click</span>
            </button>
          ))}
        </div>
      </div>

      {/* Empty State: Reusable FileDropzone */}
      {paragraphs.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-10 shadow-sm">
          <FileDropzone
            onFileSelected={loadPdfDocument}
            title="Drop your PDF document here to open in PDF Space"
            description="Extracts paragraphs in real time and renders interactive 1-to-1 side-by-side translation with synchronized scrolling."
            badge="⚡ Instant Side-by-Side Bilingual Reading"
            variant="emerald"
          />
        </div>
      ) : viewMode === 'table_1to1' ? (
        /* ================= MODE 1: PURE 1-TO-1 ALIGNED PARALLEL TABLE ================= */
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
          {/* Table Header */}
          <div className="grid grid-cols-12 bg-slate-50 dark:bg-slate-800/90 border-b border-slate-200 dark:border-slate-700 px-4 py-3 text-xs font-bold text-slate-700 dark:text-slate-200">
            <div className="col-span-1 text-slate-400 font-mono text-[11px]">#</div>
            <div className="col-span-5 flex items-center gap-2">
              <BookOpen className="w-3.5 h-3.5 text-slate-500" />
              <span>ORIGINAL SOURCE ({sourceLang.toUpperCase()})</span>
            </div>
            <div className="col-span-6 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Languages className="w-3.5 h-3.5 text-emerald-600" />
                <span className="text-emerald-700 dark:text-emerald-400">
                  ONE-TO-ONE TRANSLATION ({currentTargetLangObj.name.toUpperCase()} {currentTargetLangObj.flag})
                </span>
              </div>
              {isTranslatingAll && (
                <span className="flex items-center gap-1 text-[10px] text-emerald-600 font-semibold animate-pulse">
                  <Loader2 className="w-3 h-3 animate-spin" />
                  <span>Translating...</span>
                </span>
              )}
            </div>
          </div>

          {/* Table Body: 100% Exact Row Alignment */}
          <div className="divide-y divide-slate-100 dark:divide-slate-800 max-h-[750px] overflow-y-auto">
            {paragraphs.map((para) => {
              const isHighlighted = highlightedParaId === para.id;
              const isEditing = editingParaId === para.id;

              return (
                <div
                  key={para.id}
                  onMouseEnter={() => setHighlightedParaId(para.id)}
                  onMouseLeave={() => setHighlightedParaId(null)}
                  className={`grid grid-cols-12 px-4 py-4 transition-colors ${
                    isHighlighted
                      ? 'bg-emerald-50/70 dark:bg-emerald-950/40 ring-1 ring-emerald-500'
                      : 'hover:bg-slate-50/50 dark:hover:bg-slate-800/30'
                  }`}
                >
                  {/* Row Indicator */}
                  <div className="col-span-1 text-[11px] font-mono text-slate-400 pt-1">
                    § {para.paragraphIndex}
                  </div>

                  {/* Left Cell: Source Text */}
                  <div className="col-span-5 pr-6 space-y-2">
                    <p className="text-xs sm:text-sm text-slate-800 dark:text-slate-200 leading-relaxed font-sans">
                      {para.sourceText}
                    </p>
                    <div className="flex items-center gap-2 text-[10px] text-slate-400">
                      <button
                        onClick={() => handleSpeak(para.sourceText, sourceLang, `src_${para.id}`)}
                        className="p-1 hover:bg-slate-200 dark:hover:bg-slate-700 rounded text-slate-500 hover:text-emerald-600 flex items-center gap-1"
                        title="Listen to original text"
                      >
                        <Volume2 className={`w-3.5 h-3.5 ${speakingId === `src_${para.id}` ? 'text-emerald-600 animate-pulse' : ''}`} />
                        <span>Listen</span>
                      </button>
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(para.sourceText);
                          showToast(`Copied source § ${para.paragraphIndex}`);
                        }}
                        className="p-1 hover:bg-slate-200 dark:hover:bg-slate-700 rounded text-slate-500 hover:text-emerald-600 flex items-center gap-1"
                        title="Copy source text"
                      >
                        <Copy className="w-3.5 h-3.5" />
                        <span>Copy</span>
                      </button>
                    </div>
                  </div>

                  {/* Right Cell: Exactly Aligned Translation */}
                  <div
                    dir={currentTargetLangObj.isRtl ? 'rtl' : 'ltr'}
                    className="col-span-6 pl-4 border-l border-slate-100 dark:border-slate-800 space-y-2"
                  >
                    {isEditing ? (
                      <div className="space-y-2">
                        <textarea
                          value={editInputText}
                          onChange={(e) => setEditInputText(e.target.value)}
                          className="w-full p-2.5 rounded-xl border border-emerald-500 bg-white dark:bg-slate-800 text-xs text-slate-800 dark:text-white focus:outline-none ring-2 ring-emerald-500/20"
                          rows={3}
                        />
                        <div className="flex justify-end gap-2 text-xs">
                          <button
                            onClick={() => setEditingParaId(null)}
                            className="px-2.5 py-1 rounded-lg border text-slate-500 hover:bg-slate-100"
                          >
                            Cancel
                          </button>
                          <button
                            onClick={() => handleSaveEdit(para.id)}
                            className="px-3 py-1 rounded-lg bg-emerald-600 text-white font-bold"
                          >
                            Save
                          </button>
                        </div>
                      </div>
                    ) : para.isTranslating ? (
                      <div className="flex items-center gap-2 text-xs text-emerald-600 py-2">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span className="font-semibold">Translating paragraph in real time...</span>
                      </div>
                    ) : (
                      <p className="text-xs sm:text-sm text-slate-900 dark:text-slate-100 leading-relaxed font-sans font-medium">
                        {para.translatedText || <span className="text-slate-400 italic">Translation pending...</span>}
                      </p>
                    )}

                    <div className="flex items-center gap-2 text-[10px] text-slate-400">
                      <button
                        onClick={() => handleSpeak(para.translatedText || para.sourceText, targetLang, `trans_${para.id}`)}
                        className="p-1 hover:bg-slate-200 dark:hover:bg-slate-700 rounded text-slate-500 hover:text-emerald-600 flex items-center gap-1"
                        title="Listen to translation"
                      >
                        <Volume2 className={`w-3.5 h-3.5 ${speakingId === `trans_${para.id}` ? 'text-emerald-600 animate-pulse' : ''}`} />
                        <span>Listen</span>
                      </button>
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(para.translatedText);
                          setCopiedId(para.id);
                          setTimeout(() => setCopiedId(null), 1800);
                          showToast(`Copied translation for § ${para.paragraphIndex}`);
                        }}
                        className="p-1 hover:bg-slate-200 dark:hover:bg-slate-700 rounded text-slate-500 hover:text-emerald-600 flex items-center gap-1"
                        title="Copy translation"
                      >
                        {copiedId === para.id ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                        <span>{copiedId === para.id ? 'Copied' : 'Copy'}</span>
                      </button>
                      <button
                        onClick={() => {
                          setEditingParaId(para.id);
                          setEditInputText(para.translatedText);
                        }}
                        className="p-1 hover:bg-slate-200 dark:hover:bg-slate-700 rounded text-slate-500 hover:text-emerald-600 flex items-center gap-1"
                        title="Edit translation"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                        <span>Edit</span>
                      </button>
                      {para.isUserEdited && (
                        <span className="px-1.5 py-0.2 rounded bg-amber-100 text-amber-800 dark:bg-amber-950 text-[9px] font-bold">
                          Edited
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        /* ================= MODE 2: VISUAL CANVAS SPLIT ================= */
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 min-h-[720px] max-h-[820px]">
          {/* Left Canvas Window */}
          <div className="lg:col-span-6 flex flex-col bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
            <div className="px-4 py-3 bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <BookOpen className="w-3.5 h-3.5 text-slate-500" />
                <span className="font-bold text-slate-800 dark:text-white">Original PDF Render (Page {currentPage})</span>
              </div>
              <span className="text-[11px] font-mono text-slate-400">{file?.name}</span>
            </div>

            <div className="flex-1 p-4 overflow-auto bg-slate-100/50 dark:bg-slate-950/40 flex items-center justify-center">
              <canvas ref={canvasRef} className="rounded shadow-lg max-w-full border bg-white" />
            </div>
          </div>

          {/* Right Translated Stream */}
          <div
            ref={rightPaneRef}
            dir={currentTargetLangObj.isRtl ? 'rtl' : 'ltr'}
            className="lg:col-span-6 flex flex-col bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden"
          >
            <div className="px-4 py-3 bg-emerald-50/70 dark:bg-slate-800/80 border-b border-emerald-100 dark:border-slate-700 flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <Languages className="w-3.5 h-3.5 text-emerald-600" />
                <span className="font-bold text-slate-900 dark:text-white">
                  Real-Time Translation ({currentTargetLangObj.name} {currentTargetLangObj.flag})
                </span>
              </div>
            </div>

            <div className="flex-1 p-5 overflow-y-auto space-y-4 bg-slate-50/40 dark:bg-slate-950/20">
              {paragraphs.map((para) => (
                <div
                  key={para.id}
                  className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-2"
                >
                  <div className="flex items-center justify-between text-[10px] text-slate-400 font-mono pb-1.5 border-b border-slate-100 dark:border-slate-800">
                    <span>§ {para.paragraphIndex} &bull; {targetLang.toUpperCase()}</span>
                    <button
                      onClick={() => handleSpeak(para.translatedText, targetLang, `trans_${para.id}`)}
                      className="p-1 hover:bg-slate-100 rounded text-slate-500 hover:text-emerald-600"
                    >
                      <Volume2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <p className="text-xs sm:text-sm text-slate-900 dark:text-slate-100 leading-relaxed font-sans font-medium">
                    {para.translatedText}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
