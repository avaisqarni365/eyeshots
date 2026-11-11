'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { 
  ArrowLeftRight, 
  Sparkles, 
  Download, 
  ChevronRight, 
  ChevronLeft, 
  Eye, 
  Split, 
  FileText, 
  ZoomIn, 
  ZoomOut, 
  CheckCircle2, 
  Loader2, 
  Layers, 
  Sliders, 
  SlidersHorizontal,
  Table,
  Check,
  Copy,
  AlertCircle,
  FileDown,
  Maximize2,
  RefreshCw,
  Plus,
  Minus,
  Percent,
  Edit3,
  Trash2,
  ArrowRight
} from 'lucide-react';
import { FileDropzone } from '@/components/FileDropzone';
import { 
  COMPARE_SAMPLES, 
  CompareSample, 
  computeWordDiff, 
  extractTextFromPdfPage, 
  generateCompareSampleBytes, 
  exportComparisonReportPdf,
  ComparisonResult, 
  PageDiffSummary,
  DiffToken,
  FormFieldItem,
  extractFormFieldsFromPdfBytes,
  syncFormFieldsBetweenPdfs
} from '@/lib/pdf/compare-engine';
import * as pdfjsLib from 'pdfjs-dist';

if (typeof window !== 'undefined') {
  pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';
}

export type CompareViewMode = 'side_by_side' | 'swipe_overlay' | 'text_diff' | 'sync_fields';

export default function ComparePdfPage() {
  // Document Files & PDF Proxies
  const [fileA, setFileA] = useState<File | null>(null);
  const [fileB, setFileB] = useState<File | null>(null);
  const [docA, setDocA] = useState<pdfjsLib.PDFDocumentProxy | null>(null);
  const [docB, setDocB] = useState<pdfjsLib.PDFDocumentProxy | null>(null);

  // Pagination & Zoom
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [numPages, setNumPages] = useState<number>(1);
  const [zoomScale, setZoomScale] = useState<number>(1.1);
  const [viewMode, setViewMode] = useState<CompareViewMode>('side_by_side');
  const [isLoadingPages, setIsLoadingPages] = useState<boolean>(false);
  const [syncScroll, setSyncScroll] = useState<boolean>(true);

  // Swipe Overlay State
  const [swipePosition, setSwipePosition] = useState<number>(50); // percentage 0 to 100
  const [isDraggingSwipe, setIsDraggingSwipe] = useState<boolean>(false);
  const [showDifferenceHighlight, setShowDifferenceHighlight] = useState<boolean>(false);

  // Text Diff State
  const [diffTokens, setDiffTokens] = useState<DiffToken[]>([]);
  const [pageSummary, setPageSummary] = useState<PageDiffSummary | null>(null);
  const [comparisonResult, setComparisonResult] = useState<ComparisonResult | null>(null);
  const [isDiffing, setIsDiffing] = useState<boolean>(false);

  // UI Toast & Export State
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState<boolean>(false);

  // Raw Bytes & Form Sync State
  const [bytesA, setBytesA] = useState<Uint8Array | null>(null);
  const [bytesB, setBytesB] = useState<Uint8Array | null>(null);
  const [fieldsA, setFieldsA] = useState<FormFieldItem[]>([]);
  const [selectedFieldNames, setSelectedFieldNames] = useState<string[]>([]);
  const [isPortingFields, setIsPortingFields] = useState<boolean>(false);
  const [portedDocBBlob, setPortedDocBBlob] = useState<Blob | null>(null);
  const [portedFieldsSummary, setPortedFieldsSummary] = useState<string[]>([]);
  const [syncDirection, setSyncDirection] = useState<'A_to_B' | 'B_to_A'>('A_to_B');
  const [syncAction, setSyncAction] = useState<'copy' | 'move'>('copy');
  const [customFieldValues, setCustomFieldValues] = useState<Record<string, string | boolean>>({});
  const [editingFieldName, setEditingFieldName] = useState<string | null>(null);
  const [editingInputText, setEditingInputText] = useState<string>('');

  // Canvas Refs
  const canvasARef = useRef<HTMLCanvasElement | null>(null);
  const canvasBRef = useRef<HTMLCanvasElement | null>(null);
  const swipeOverlayRef = useRef<HTMLDivElement | null>(null);
  const paneARef = useRef<HTMLDivElement | null>(null);
  const paneBRef = useRef<HTMLDivElement | null>(null);
  const isScrollingSyncRef = useRef<boolean>(false);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3200);
  };

  // Render a specific page of a PDF document to an HTML5 Canvas
  const renderPageToCanvas = useCallback(
    async (
      pdfProxy: pdfjsLib.PDFDocumentProxy,
      pageNum: number,
      canvas: HTMLCanvasElement | null,
      scale: number
    ) => {
      if (!canvas) return;
      try {
        const page = await pdfProxy.getPage(Math.min(pageNum, pdfProxy.numPages));
        const viewport = page.getViewport({ scale });

        canvas.width = viewport.width;
        canvas.height = viewport.height;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        await page.render({ canvasContext: ctx, viewport }).promise;
      } catch (err) {
        console.error('Error rendering page to canvas:', err);
      }
    },
    []
  );

  // Render both documents on the current page
  const renderCurrentPages = useCallback(
    async (targetScale = zoomScale) => {
      setIsLoadingPages(true);
      try {
        if (docA && canvasARef.current) {
          await renderPageToCanvas(docA, currentPage, canvasARef.current, targetScale);
        }
        if (docB && canvasBRef.current) {
          await renderPageToCanvas(docB, currentPage, canvasBRef.current, targetScale);
        }
      } finally {
        setIsLoadingPages(false);
      }
    },
    [docA, docB, currentPage, zoomScale, renderPageToCanvas]
  );

  // Compute text diff for current page
  const computePageTextDiff = useCallback(
    async (pA: pdfjsLib.PDFDocumentProxy, pB: pdfjsLib.PDFDocumentProxy, pageNum: number) => {
      setIsDiffing(true);
      try {
        const textA = await extractTextFromPdfPage(pA, Math.min(pageNum, pA.numPages));
        const textB = await extractTextFromPdfPage(pB, Math.min(pageNum, pB.numPages));

        const tokens = computeWordDiff(textA, textB);
        setDiffTokens(tokens);

        const additions = tokens.filter((t) => t.type === 'added').length;
        const deletions = tokens.filter((t) => t.type === 'deleted').length;
        const unchanged = tokens.filter((t) => t.type === 'unchanged').length;
        const total = additions + deletions + unchanged || 1;
        const similarityRatio = unchanged / total;

        const summary: PageDiffSummary = {
          pageNumber: pageNum,
          additions,
          deletions,
          unchanged,
          similarityRatio,
          tokens,
        };
        setPageSummary(summary);

        setComparisonResult({
          docAName: fileA?.name || 'Document_A.pdf',
          docBName: fileB?.name || 'Document_B.pdf',
          totalAdditions: additions,
          totalDeletions: deletions,
          overallSimilarity: similarityRatio,
          pages: [summary],
        });
      } catch (err) {
        console.error('Failed to compute diff:', err);
      } finally {
        setIsDiffing(false);
      }
    },
    [fileA, fileB]
  );

  // Update canvases whenever docA, docB, currentPage, or viewMode changes
  useEffect(() => {
    if (docA && docB) {
      renderCurrentPages();
      computePageTextDiff(docA, docB, currentPage);
    }
  }, [docA, docB, currentPage, viewMode, renderCurrentPages, computePageTextDiff]);

  // Load Document A
  const handleLoadDocA = async (file: File) => {
    setFileA(file);
    try {
      const buffer = await file.arrayBuffer();
      const uint8 = new Uint8Array(buffer);
      setBytesA(uint8);

      const loadingTask = pdfjsLib.getDocument({
        data: uint8.slice(), // pdf.js detaches the buffer it receives; keep uint8 usable
        cMapUrl: '/pdfjs/cmaps/',
        cMapPacked: true,
      });
      const proxy = await loadingTask.promise;
      setDocA(proxy);
      setNumPages((prev) => Math.max(prev, proxy.numPages));

      const extracted = await extractFormFieldsFromPdfBytes(uint8, 'A');
      setFieldsA(extracted);
      setSelectedFieldNames(extracted.map((f) => f.name));

      showToast(`Loaded Document A: "${file.name}" (${proxy.numPages} pages, ${extracted.length} detected fields)`);
    } catch (err: any) {
      showToast('Error loading Document A: ' + (err.message || 'Check format'));
    }
  };

  // Load Document B
  const handleLoadDocB = async (file: File) => {
    setFileB(file);
    try {
      const buffer = await file.arrayBuffer();
      const uint8 = new Uint8Array(buffer);
      setBytesB(uint8);

      const loadingTask = pdfjsLib.getDocument({
        data: uint8.slice(), // pdf.js detaches the buffer it receives; keep uint8 usable
        cMapUrl: '/pdfjs/cmaps/',
        cMapPacked: true,
      });
      const proxy = await loadingTask.promise;
      setDocB(proxy);
      setNumPages((prev) => Math.max(prev, proxy.numPages));
      showToast(`Loaded Document B: "${file.name}" (${proxy.numPages} pages)`);
    } catch (err: any) {
      showToast('Error loading Document B: ' + (err.message || 'Check format'));
    }
  };

  // Load Built-in Realistic 1-Click Comparison Sample
  const handleLoadSample = async (sample: CompareSample) => {
    try {
      showToast(`Generating genuine sample documents for ${sample.title}...`);

      const [sampleBytesA, sampleBytesB] = await Promise.all([
        generateCompareSampleBytes(sample.id, 'A'),
        generateCompareSampleBytes(sample.id, 'B'),
      ]);

      setBytesA(sampleBytesA);
      setBytesB(sampleBytesB);

      const sampleFileA = new File([sampleBytesA as any], sample.docAName, { type: 'application/pdf' });
      const sampleFileB = new File([sampleBytesB as any], sample.docBName, { type: 'application/pdf' });

      setFileA(sampleFileA);
      setFileB(sampleFileB);

      const [loadingA, loadingB] = await Promise.all([
        pdfjsLib.getDocument({ data: new Uint8Array(sampleBytesA).slice() }).promise,
        pdfjsLib.getDocument({ data: new Uint8Array(sampleBytesB).slice() }).promise,
      ]);

      setDocA(loadingA);
      setDocB(loadingB);
      setNumPages(Math.max(loadingA.numPages, loadingB.numPages));
      setCurrentPage(1);

      const extracted = await extractFormFieldsFromPdfBytes(sampleBytesA, 'A');
      setFieldsA(extracted);
      setSelectedFieldNames(extracted.map((f) => f.name));

      showToast(`Loaded "${sample.title}"! Comparison ready.`);
    } catch (err: any) {
      console.error('Failed to load sample:', err);
      showToast('Sample error: ' + err.message);
    }
  };

  // Toggle selection for a single field
  const handleToggleField = (fieldName: string) => {
    setSelectedFieldNames((prev) =>
      prev.includes(fieldName) ? prev.filter((n) => n !== fieldName) : [...prev, fieldName]
    );
  };

  // Select / Deselect All
  const handleToggleAllFields = () => {
    if (selectedFieldNames.length === fieldsA.length) {
      setSelectedFieldNames([]);
    } else {
      setSelectedFieldNames(fieldsA.map((f) => f.name));
    }
  };

  // Port / Sync Checked Fields from Document A to Document B
  // Port / Sync Checked Fields between Document A and Document B
  const handlePortFieldsToDocB = async () => {
    if (!bytesA || !bytesB) {
      showToast('Both Document A and Document B must be loaded first.');
      return;
    }
    if (selectedFieldNames.length === 0) {
      showToast('Please check at least one field to port.');
      return;
    }

    setIsPortingFields(true);
    showToast(`Transferring field values (${syncDirection === 'A_to_B' ? 'A -> B' : 'B -> A'}, ${syncAction.toUpperCase()})...`);

    try {
      const result = await syncFormFieldsBetweenPdfs(bytesA, bytesB, {
        selectedFieldNames,
        direction: syncDirection,
        action: syncAction,
        customValues: customFieldValues,
      });

      if (syncDirection === 'A_to_B') {
        setBytesB(result.updatedBytes);
        if (result.updatedSourceBytes) {
          setBytesA(result.updatedSourceBytes);
          const loadA = pdfjsLib.getDocument({ data: new Uint8Array(result.updatedSourceBytes).slice() });
          setDocA(await loadA.promise);
        }
        const blob = new Blob([result.updatedBytes as any], { type: 'application/pdf' });
        setPortedDocBBlob(blob);
        const loadB = pdfjsLib.getDocument({
          data: new Uint8Array(result.updatedBytes).slice(),
          cMapUrl: '/pdfjs/cmaps/',
          cMapPacked: true,
        });
        setDocB(await loadB.promise);
      } else {
        setBytesA(result.updatedBytes);
        if (result.updatedSourceBytes) {
          setBytesB(result.updatedSourceBytes);
          const loadB = pdfjsLib.getDocument({ data: new Uint8Array(result.updatedSourceBytes).slice() });
          setDocB(await loadB.promise);
        }
        const blob = new Blob([result.updatedBytes as any], { type: 'application/pdf' });
        setPortedDocBBlob(blob);
        const loadA = pdfjsLib.getDocument({
          data: new Uint8Array(result.updatedBytes).slice(),
          cMapUrl: '/pdfjs/cmaps/',
          cMapPacked: true,
        });
        setDocA(await loadA.promise);
      }

      setPortedFieldsSummary(result.portedFields);
      showToast(`Successfully transferred ${result.portedCount} field values!`);
    } catch (err: any) {
      console.error('Field porting error:', err);
      showToast('Sync error: ' + (err.message || 'Check form compatibility'));
    } finally {
      setIsPortingFields(false);
    }
  };

  // Port a single field instantly
  const handlePortSingleField = async (fieldName: string) => {
    if (!bytesA || !bytesB) return;
    setIsPortingFields(true);
    showToast(`Transferring field "${fieldName}"...`);
    try {
      const result = await syncFormFieldsBetweenPdfs(bytesA, bytesB, {
        selectedFieldNames: [fieldName],
        direction: syncDirection,
        action: syncAction,
        customValues: customFieldValues,
      });

      if (syncDirection === 'A_to_B') {
        setBytesB(result.updatedBytes);
        if (result.updatedSourceBytes) {
          setBytesA(result.updatedSourceBytes);
          const loadA = pdfjsLib.getDocument({ data: new Uint8Array(result.updatedSourceBytes).slice() });
          setDocA(await loadA.promise);
        }
        const blob = new Blob([result.updatedBytes as any], { type: 'application/pdf' });
        setPortedDocBBlob(blob);
        const loadB = pdfjsLib.getDocument({ data: new Uint8Array(result.updatedBytes).slice() });
        setDocB(await loadB.promise);
      } else {
        setBytesA(result.updatedBytes);
        if (result.updatedSourceBytes) {
          setBytesB(result.updatedSourceBytes);
          const loadB = pdfjsLib.getDocument({ data: new Uint8Array(result.updatedSourceBytes).slice() });
          setDocB(await loadB.promise);
        }
        const blob = new Blob([result.updatedBytes as any], { type: 'application/pdf' });
        setPortedDocBBlob(blob);
        const loadA = pdfjsLib.getDocument({ data: new Uint8Array(result.updatedBytes).slice() });
        setDocA(await loadA.promise);
      }
      setPortedFieldsSummary(result.portedFields);
      showToast(`Field "${fieldName}" transferred successfully!`);
    } catch (err: any) {
      showToast('Error transferring field: ' + err.message);
    } finally {
      setIsPortingFields(false);
    }
  };

  // In-place field edit save
  const handleSaveFieldEdit = (fieldName: string) => {
    setCustomFieldValues((prev) => ({
      ...prev,
      [fieldName]: editingInputText,
    }));
    setEditingFieldName(null);
    showToast(`Updated value for "${fieldName}".`);
  };

  // Download Ported Document B
  const handleDownloadPortedDocB = () => {
    if (!portedDocBBlob) return;
    const url = URL.createObjectURL(portedDocBBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${fileB?.name?.replace(/\.pdf$/i, '') || 'Document_B'}_PortedFillings.pdf`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast('Downloaded updated Document B with ported fillings!');
  };

  // Swap Document A and B
  const handleSwapDocuments = () => {
    const tempFile = fileA;
    const tempDoc = docA;
    setFileA(fileB);
    setDocA(docB);
    setFileB(tempFile);
    setDocB(tempDoc);
    showToast('Swapped Base and Revised documents.');
  };

  // Synchronized Scrolling between Pane A and Pane B
  const handleScrollA = () => {
    if (!syncScroll || isScrollingSyncRef.current) return;
    if (!paneARef.current || !paneBRef.current) return;

    isScrollingSyncRef.current = true;
    const pct = paneARef.current.scrollTop / (paneARef.current.scrollHeight - paneARef.current.clientHeight || 1);
    paneBRef.current.scrollTop = pct * (paneBRef.current.scrollHeight - paneBRef.current.clientHeight);

    setTimeout(() => {
      isScrollingSyncRef.current = false;
    }, 40);
  };

  const handleScrollB = () => {
    if (!syncScroll || isScrollingSyncRef.current) return;
    if (!paneARef.current || !paneBRef.current) return;

    isScrollingSyncRef.current = true;
    const pct = paneBRef.current.scrollTop / (paneBRef.current.scrollHeight - paneBRef.current.clientHeight || 1);
    paneARef.current.scrollTop = pct * (paneARef.current.scrollHeight - paneARef.current.clientHeight);

    setTimeout(() => {
      isScrollingSyncRef.current = false;
    }, 40);
  };

  // Zoom Handler
  const handleZoom = (delta: number) => {
    const next = Math.min(2.4, Math.max(0.6, Math.round((zoomScale + delta) * 10) / 10));
    setZoomScale(next);
    renderCurrentPages(next);
  };

  // Swipe mouse drag handlers
  const handleSwipeMouseMove = (e: React.MouseEvent) => {
    if (!isDraggingSwipe || !swipeOverlayRef.current) return;
    const rect = swipeOverlayRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const pct = Math.max(0, Math.min(100, (x / rect.width) * 100));
    setSwipePosition(pct);
  };

  // Export Comparison Report PDF
  const handleExportReport = async () => {
    if (!comparisonResult) return;
    setIsExporting(true);
    showToast('Generating official One-to-One comparison audit report...');

    try {
      const pdfBytes = await exportComparisonReportPdf(comparisonResult);
      const blob = new Blob([pdfBytes as any], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `EyeShots_Comparison_${fileA?.name?.replace(/\.pdf$/i, '') || 'DocA'}_vs_${fileB?.name?.replace(/\.pdf$/i, '') || 'DocB'}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      showToast('Comparison Audit Report successfully exported!');
    } catch (err: any) {
      console.error('Export error:', err);
      showToast('Export failed: ' + (err.message || 'Check documents'));
    } finally {
      setIsExporting(false);
    }
  };

  const isReadyToCompare = docA !== null && docB !== null;

  return (
    <div className="max-w-[1650px] mx-auto px-4 sm:px-6 py-6 space-y-4 select-none">
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
        <Link href="/pdf-space" className="hover:text-emerald-600 transition-colors">PDF Space</Link>
        <ChevronRight className="w-3.5 h-3.5" />
        <span className="text-slate-900 dark:text-white font-semibold">One-to-One PDF Compare Suite</span>
      </nav>

      {/* Main Header & Toolbar */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-4 sm:p-5 shadow-sm space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-3 border-b border-slate-100 dark:border-slate-800">
          <div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 text-xs font-semibold border border-emerald-200 dark:border-emerald-800/60 mb-1.5">
              <Split className="w-3.5 h-3.5 text-emerald-600" />
              <span>100% Client-Side Vector Difference Engine &bull; Zero Server Cost &bull; Instant Privacy</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
              <span>PDF Compare: One-to-One Comparison Suite</span>
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 max-w-2xl mt-0.5">
              Compare two PDF documents side-by-side with locked navigation, interactive swipe overlay, and word-by-word semantic difference detection.
            </p>
          </div>

          {/* Quick Header Actions */}
          <div className="flex items-center gap-2 flex-wrap">
            {isReadyToCompare && (
              <>
                <button
                  onClick={handleSwapDocuments}
                  className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 text-slate-700 dark:text-slate-200 font-semibold text-xs flex items-center gap-1.5 transition-all"
                  title="Swap Document A and Document B"
                >
                  <ArrowLeftRight className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Swap Docs</span>
                </button>

                <button
                  onClick={handleExportReport}
                  disabled={isExporting}
                  className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white font-bold text-xs flex items-center gap-2 shadow-sm transition-all"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Export Audit Report</span>
                </button>
              </>
            )}
          </div>
        </div>

        {/* Navigation & Viewport Controls Ribbon */}
        <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
          {/* Mode Switcher Tabs */}
          <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-0.5 rounded-xl font-semibold">
            <button
              onClick={() => setViewMode('side_by_side')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all ${
                viewMode === 'side_by_side'
                  ? 'bg-white dark:bg-slate-700 text-emerald-600 shadow-sm font-bold'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <Split className="w-3.5 h-3.5" />
              <span>1-to-1 Side by Side</span>
            </button>

            <button
              onClick={() => setViewMode('swipe_overlay')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all ${
                viewMode === 'swipe_overlay'
                  ? 'bg-white dark:bg-slate-700 text-emerald-600 shadow-sm font-bold'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              <span>Swipe Overlay Diff</span>
            </button>

            <button
              onClick={() => setViewMode('text_diff')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all ${
                viewMode === 'text_diff'
                  ? 'bg-white dark:bg-slate-700 text-emerald-600 shadow-sm font-bold'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <FileText className="w-3.5 h-3.5" />
              <span>Semantic Text Diff</span>
            </button>

            <button
              onClick={() => setViewMode('sync_fields')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all ${
                viewMode === 'sync_fields'
                  ? 'bg-white dark:bg-slate-700 text-emerald-600 shadow-sm font-bold'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <Copy className="w-3.5 h-3.5" />
              <span>⚡ Port Fillings (A ➔ B)</span>
            </button>
          </div>

          {/* Page Switcher & Zoom Controls */}
          {isReadyToCompare && (
            <div className="flex items-center gap-3 flex-wrap">
              {/* Page Navigation */}
              {numPages > 1 && (
                <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded-xl">
                  <button
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    disabled={currentPage <= 1 || isLoadingPages}
                    className="p-1 hover:bg-white dark:hover:bg-slate-700 rounded disabled:opacity-30 text-slate-600"
                    title="Previous Page"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                  </button>

                  <span className="text-[11px] font-mono font-bold text-slate-700 dark:text-slate-200 px-1">
                    Page {currentPage} / {numPages}
                  </span>

                  <button
                    onClick={() => setCurrentPage((p) => Math.min(numPages, p + 1))}
                    disabled={currentPage >= numPages || isLoadingPages}
                    className="p-1 hover:bg-white dark:hover:bg-slate-700 rounded disabled:opacity-30 text-slate-600"
                    title="Next Page"
                  >
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}

              {/* Zoom Controls */}
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

              {/* Sync Scroll Toggle */}
              {viewMode === 'side_by_side' && (
                <button
                  onClick={() => setSyncScroll((s) => !s)}
                  className={`px-2.5 py-1.5 rounded-xl font-bold flex items-center gap-1.5 transition-all text-xs border ${
                    syncScroll
                      ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300'
                      : 'border-slate-200 dark:border-slate-700 text-slate-500'
                  }`}
                >
                  <Split className="w-3.5 h-3.5" />
                  <span>Sync: {syncScroll ? 'ON' : 'OFF'}</span>
                </button>
              )}

              {/* Difference Blend Heatmap Toggle in Swipe Mode */}
              {viewMode === 'swipe_overlay' && (
                <button
                  onClick={() => setShowDifferenceHighlight((prev) => !prev)}
                  className={`px-2.5 py-1.5 rounded-xl font-bold flex items-center gap-1.5 transition-all text-xs border ${
                    showDifferenceHighlight
                      ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300'
                      : 'border-slate-200 dark:border-slate-700 text-slate-500'
                  }`}
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Difference Heatmap: {showDifferenceHighlight ? 'ON' : 'OFF'}</span>
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Preset Built-in Sample Documents Strip */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-3 shadow-sm flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2 font-bold text-slate-700 dark:text-slate-200">
          <Sparkles className="w-4 h-4 text-emerald-600" />
          <span>Try Instant 1-Click Comparison Samples:</span>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {COMPARE_SAMPLES.map((sample) => (
            <button
              key={sample.id}
              onClick={() => handleLoadSample(sample)}
              className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 hover:border-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 text-slate-700 dark:text-slate-300 font-semibold transition-all flex items-center gap-1.5"
            >
              <span>{sample.title}</span>
              <span className="text-[10px] text-emerald-600 font-bold px-1.5 py-0.2 rounded bg-emerald-50 dark:bg-emerald-950">1-Click</span>
            </button>
          ))}
        </div>
      </div>

      {/* Empty State: Dual Dropzones for Document A and Document B */}
      {!isReadyToCompare ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-8 shadow-sm">
          {/* Document A Upload Zone */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Document A (Original / Base)</span>
              {fileA && (
                <span className="text-xs text-emerald-600 font-bold flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>{fileA.name}</span>
                </span>
              )}
            </div>
            <FileDropzone
              onFileSelected={handleLoadDocA}
              title="Drop Document A (Base PDF)"
              description="Original contract, previous revision, or initial form draft."
              badge="📄 Original Version A"
              variant="blue"
            />
          </div>

          {/* Document B Upload Zone */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Document B (Modified / Revised)</span>
              {fileB && (
                <span className="text-xs text-emerald-600 font-bold flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>{fileB.name}</span>
                </span>
              )}
            </div>
            <FileDropzone
              onFileSelected={handleLoadDocB}
              title="Drop Document B (Revised PDF)"
              description="Revised contract, edited form, or newly signed document."
              badge="📝 Modified Version B"
              variant="emerald"
            />
          </div>
        </div>
      ) : (
        /* ================= COMPARISON WORKSPACE ================= */
        <div className="space-y-4">
          {/* Quick Metrics Bar */}
          {pageSummary && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="bg-white dark:bg-slate-900 p-3 rounded-2xl border border-slate-200 dark:border-slate-800 flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase">Page Match Ratio</span>
                  <div className="text-lg font-extrabold text-slate-800 dark:text-white">
                    {(pageSummary.similarityRatio * 100).toFixed(1)}%
                  </div>
                </div>
                <Percent className="w-5 h-5 text-emerald-600" />
              </div>

              <div className="bg-white dark:bg-slate-900 p-3 rounded-2xl border border-slate-200 dark:border-slate-800 flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-bold text-emerald-600 uppercase">Words Added</span>
                  <div className="text-lg font-extrabold text-emerald-600">
                    +{pageSummary.additions}
                  </div>
                </div>
                <Plus className="w-5 h-5 text-emerald-600" />
              </div>

              <div className="bg-white dark:bg-slate-900 p-3 rounded-2xl border border-slate-200 dark:border-slate-800 flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-bold text-red-500 uppercase">Words Deleted</span>
                  <div className="text-lg font-extrabold text-red-600">
                    -{pageSummary.deletions}
                  </div>
                </div>
                <Minus className="w-5 h-5 text-red-500" />
              </div>

              <div className="bg-white dark:bg-slate-900 p-3 rounded-2xl border border-slate-200 dark:border-slate-800 flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase">Unchanged Words</span>
                  <div className="text-lg font-extrabold text-slate-600 dark:text-slate-300">
                    {pageSummary.unchanged}
                  </div>
                </div>
                <CheckCircle2 className="w-5 h-5 text-slate-400" />
              </div>
            </div>
          )}

          {/* ================= VIEW MODE 1: SYNCHRONIZED 1-TO-1 SIDE BY SIDE ================= */}
          {viewMode === 'side_by_side' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 min-h-[760px]">
              {/* Document A Window */}
              <div className="lg:col-span-6 flex flex-col bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
                <div className="px-4 py-2.5 bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-slate-400" />
                    <span className="font-bold text-slate-800 dark:text-white">DOCUMENT A (BASE): {fileA?.name}</span>
                  </div>
                  <span className="text-[11px] font-mono text-slate-400">Page {currentPage} of {docA?.numPages || 1}</span>
                </div>

                <div
                  ref={paneARef}
                  onScroll={handleScrollA}
                  className="flex-1 p-4 overflow-auto bg-slate-100/60 dark:bg-slate-950/40 flex items-start justify-center max-h-[780px]"
                >
                  <canvas ref={canvasARef} className="rounded shadow-lg max-w-full border bg-white" />
                </div>
              </div>

              {/* Document B Window */}
              <div className="lg:col-span-6 flex flex-col bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
                <div className="px-4 py-2.5 bg-emerald-50/70 dark:bg-slate-800/80 border-b border-emerald-100 dark:border-slate-700 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-500" />
                    <span className="font-bold text-slate-900 dark:text-white">DOCUMENT B (REVISED): {fileB?.name}</span>
                  </div>
                  <span className="text-[11px] font-mono text-slate-400">Page {currentPage} of {docB?.numPages || 1}</span>
                </div>

                <div
                  ref={paneBRef}
                  onScroll={handleScrollB}
                  className="flex-1 p-4 overflow-auto bg-slate-100/60 dark:bg-slate-950/40 flex items-start justify-center max-h-[780px]"
                >
                  <canvas ref={canvasBRef} className="rounded shadow-lg max-w-full border bg-white" />
                </div>
              </div>
            </div>
          )}

          {/* ================= VIEW MODE 2: INTERACTIVE SWIPE / OVERLAY DIFF ================= */}
          {viewMode === 'swipe_overlay' && (
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm p-4 space-y-3">
              <div className="flex items-center justify-between text-xs pb-2 border-b border-slate-100 dark:border-slate-800">
                <span className="font-bold text-slate-700 dark:text-slate-300">
                  Drag the central split slider to swipe between Document A and Document B:
                </span>
                <span className="text-[11px] font-mono text-emerald-600 font-bold">
                  Divider Position: {Math.round(swipePosition)}%
                </span>
              </div>

              <div
                ref={swipeOverlayRef}
                onMouseMove={handleSwipeMouseMove}
                onMouseDown={() => setIsDraggingSwipe(true)}
                onMouseUp={() => setIsDraggingSwipe(false)}
                onMouseLeave={() => setIsDraggingSwipe(false)}
                className="relative overflow-hidden rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-100 dark:bg-slate-950 flex items-center justify-center p-4 cursor-ew-resize min-h-[720px]"
              >
                {/* Document A Layer (Base) */}
                <div className="relative">
                  <canvas
                    ref={canvasARef}
                    className="rounded shadow-xl max-w-full border bg-white block"
                  />

                  {/* Document B Overlay (Clipped by Swipe Percentage) */}
                  <div
                    className="absolute top-0 right-0 bottom-0 overflow-hidden pointer-events-none"
                    style={{
                      left: `${swipePosition}%`,
                    }}
                  >
                    <div
                      style={{
                        transform: `translateX(-${swipePosition}%)`,
                      }}
                      className={showDifferenceHighlight ? 'mix-blend-difference filter invert' : ''}
                    >
                      <canvas
                        ref={canvasBRef}
                        className="rounded shadow-xl max-w-full border bg-white block"
                      />
                    </div>
                  </div>

                  {/* Draggable Divider Handle */}
                  <div
                    className="absolute top-0 bottom-0 w-1 bg-emerald-500 shadow-2xl z-30 flex items-center justify-center cursor-ew-resize"
                    style={{ left: `${swipePosition}%` }}
                  >
                    <div className="w-7 h-7 rounded-full bg-emerald-600 text-white flex items-center justify-center shadow-lg border-2 border-white text-[10px]">
                      <ArrowLeftRight className="w-3.5 h-3.5" />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ================= VIEW MODE 3: SEMANTIC TEXT & WORD-BY-WORD DIFF ================= */}
          {viewMode === 'text_diff' && (
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm p-6 space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4 text-emerald-600" />
                  <span className="font-bold text-sm text-slate-800 dark:text-white">
                    Word-by-Word Text Difference (Page {currentPage})
                  </span>
                </div>

                <div className="flex items-center gap-3 text-xs">
                  <span className="flex items-center gap-1 text-emerald-700 dark:text-emerald-400 font-semibold">
                    <span className="w-2.5 h-2.5 rounded bg-emerald-200 dark:bg-emerald-800 inline-block" />
                    <span>Added in Doc B</span>
                  </span>
                  <span className="flex items-center gap-1 text-red-700 dark:text-red-400 font-semibold">
                    <span className="w-2.5 h-2.5 rounded bg-red-200 dark:bg-red-800 inline-block" />
                    <span>Deleted from Doc A</span>
                  </span>
                </div>
              </div>

              {isDiffing ? (
                <div className="py-20 flex flex-col items-center justify-center gap-3 text-slate-500">
                  <Loader2 className="w-6 h-6 animate-spin text-emerald-600" />
                  <span className="text-xs font-semibold">Analyzing semantic differences between pages...</span>
                </div>
              ) : (
                <div className="p-5 rounded-2xl bg-slate-50/70 dark:bg-slate-950/40 border border-slate-200 dark:border-slate-800 font-sans text-xs sm:text-sm leading-relaxed max-h-[600px] overflow-y-auto space-x-1">
                  {diffTokens.map((token, idx) => {
                    if (token.type === 'added') {
                      return (
                        <ins
                          key={idx}
                          className="bg-emerald-100 dark:bg-emerald-950/70 text-emerald-800 dark:text-emerald-300 font-bold px-1 py-0.5 rounded no-underline border border-emerald-300 dark:border-emerald-700"
                        >
                          {token.value}
                        </ins>
                      );
                    }
                    if (token.type === 'deleted') {
                      return (
                        <del
                          key={idx}
                          className="bg-red-100 dark:bg-red-950/70 text-red-700 dark:text-red-400 line-through px-1 py-0.5 rounded border border-red-300 dark:border-red-800"
                        >
                          {token.value}
                        </del>
                      );
                    }
                    return (
                      <span key={idx} className="text-slate-700 dark:text-slate-300">
                        {token.value}
                      </span>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* ================= VIEW MODE 4: COPY & PORT FILLINGS (A ➔ B) ================= */}
          {viewMode === 'sync_fields' && (
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm p-6 space-y-6">
              {/* Header & Controls Bar */}
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-slate-100 dark:border-slate-800">
                <div>
                  <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 text-[11px] font-bold mb-1">
                    <Copy className="w-3 h-3 text-emerald-600" />
                    <span>Auto-Port AcroForms & Field Values</span>
                  </div>
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                    Copy or Move Form Fillings Between Documents
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Transfer filled text fields, checkboxes, and choices from one PDF to another without retyping.
                  </p>
                </div>

                {/* Direction & Action Selectors */}
                <div className="flex flex-wrap items-center gap-2">
                  {/* Direction Switcher */}
                  <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-0.5 rounded-xl text-xs font-semibold">
                    <button
                      onClick={() => setSyncDirection('A_to_B')}
                      className={`px-3 py-1 rounded-lg transition-all ${
                        syncDirection === 'A_to_B'
                          ? 'bg-white dark:bg-slate-700 text-emerald-600 shadow-xs font-bold'
                          : 'text-slate-500 hover:text-slate-800'
                      }`}
                    >
                      <span>A ➔ B</span>
                    </button>
                    <button
                      onClick={() => setSyncDirection('B_to_A')}
                      className={`px-3 py-1 rounded-lg transition-all ${
                        syncDirection === 'B_to_A'
                          ? 'bg-white dark:bg-slate-700 text-emerald-600 shadow-xs font-bold'
                          : 'text-slate-500 hover:text-slate-800'
                      }`}
                    >
                      <span>B ➔ A</span>
                    </button>
                  </div>

                  {/* Copy vs Move Mode */}
                  <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-0.5 rounded-xl text-xs font-semibold">
                    <button
                      onClick={() => setSyncAction('copy')}
                      className={`px-3 py-1 rounded-lg transition-all ${
                        syncAction === 'copy'
                          ? 'bg-white dark:bg-slate-700 text-emerald-600 shadow-xs font-bold'
                          : 'text-slate-500 hover:text-slate-800'
                      }`}
                      title="Keep values in source document"
                    >
                      <span>Copy</span>
                    </button>
                    <button
                      onClick={() => setSyncAction('move')}
                      className={`px-3 py-1 rounded-lg transition-all ${
                        syncAction === 'move'
                          ? 'bg-white dark:bg-slate-700 text-amber-600 shadow-xs font-bold'
                          : 'text-slate-500 hover:text-slate-800'
                      }`}
                      title="Clear values from source document after transfer"
                    >
                      <span>Move</span>
                    </button>
                  </div>

                  {/* Primary Transfer Action */}
                  <button
                    onClick={handlePortFieldsToDocB}
                    disabled={isPortingFields || fieldsA.length === 0}
                    className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white font-bold text-xs flex items-center gap-2 shadow-sm transition-all"
                  >
                    {isPortingFields ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Transferring...</span>
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-4 h-4" />
                        <span>Transfer {selectedFieldNames.length} Field{selectedFieldNames.length === 1 ? '' : 's'}</span>
                      </>
                    )}
                  </button>

                  {portedDocBBlob && (
                    <button
                      onClick={handleDownloadPortedDocB}
                      className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs flex items-center gap-2 shadow-sm transition-all"
                    >
                      <Download className="w-4 h-4" />
                      <span>Download Updated PDF</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Fields List */}
              {fieldsA.length === 0 ? (
                <div className="p-8 text-center bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-dashed border-slate-200 dark:border-slate-700 space-y-2">
                  <AlertCircle className="w-8 h-8 text-slate-400 mx-auto" />
                  <p className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                    No active interactive form fields detected in Document A.
                  </p>
                  <p className="text-[11px] text-slate-400">
                    If this is a scanned form, you can use our <Link href="/edit-pdf" className="text-emerald-600 underline">PDF Editor</Link> or <Link href="/forms" className="text-emerald-600 underline">German Forms Hub</Link> to fill out values.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-xs font-semibold text-slate-500 pb-1">
                    <span>Detected {fieldsA.length} Form Field Fillings in Document A:</span>
                    <button
                      onClick={handleToggleAllFields}
                      className="text-emerald-600 hover:text-emerald-700 text-xs font-bold"
                    >
                      {selectedFieldNames.length === fieldsA.length ? 'Deselect All' : 'Select All'}
                    </button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[440px] overflow-y-auto p-1">
                    {fieldsA.map((field) => {
                      const isChecked = selectedFieldNames.includes(field.name);
                      const isEditing = editingFieldName === field.name;
                      const activeValue = field.name in customFieldValues ? customFieldValues[field.name] : field.value;

                      return (
                        <div
                          key={field.name}
                          className={`p-3.5 rounded-xl border transition-all flex flex-col justify-between gap-2.5 ${
                            isChecked
                              ? 'bg-emerald-50/60 dark:bg-emerald-950/40 border-emerald-400 dark:border-emerald-700 shadow-xs'
                              : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 opacity-70'
                          }`}
                        >
                          <div className="flex items-start gap-2.5">
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => handleToggleField(field.name)}
                              className="mt-1 rounded text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                            />

                            <div className="flex-1 min-w-0 space-y-1">
                              <div className="flex items-center justify-between gap-2">
                                <span className="font-mono text-xs font-bold text-slate-900 dark:text-white truncate">
                                  {field.name}
                                </span>
                                <span className="text-[10px] font-semibold uppercase px-1.5 py-0.2 rounded bg-slate-100 dark:bg-slate-800 text-slate-500">
                                  {field.type}
                                </span>
                              </div>

                              {isEditing ? (
                                <div className="flex items-center gap-1.5 pt-1">
                                  <input
                                    type="text"
                                    value={editingInputText}
                                    onChange={(e) => setEditingInputText(e.target.value)}
                                    className="px-2 py-1 rounded-lg border text-xs bg-white dark:bg-slate-800 flex-1 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                                  />
                                  <button
                                    onClick={() => handleSaveFieldEdit(field.name)}
                                    className="px-2 py-1 rounded-lg bg-emerald-600 text-white text-[11px] font-bold"
                                  >
                                    Save
                                  </button>
                                  <button
                                    onClick={() => setEditingFieldName(null)}
                                    className="px-2 py-1 rounded-lg border text-slate-500 text-[11px]"
                                  >
                                    Cancel
                                  </button>
                                </div>
                              ) : (
                                <div className="text-xs text-emerald-700 dark:text-emerald-400 font-medium truncate bg-white/70 dark:bg-slate-800/80 px-2 py-1 rounded border border-slate-100 dark:border-slate-700 flex items-center justify-between">
                                  <span className="truncate">Value: <strong className="font-bold">{String(activeValue) || '(empty)'}</strong></span>
                                  <button
                                    onClick={() => {
                                      setEditingFieldName(field.name);
                                      setEditingInputText(String(activeValue));
                                    }}
                                    className="p-0.5 text-slate-400 hover:text-emerald-600"
                                    title="Edit value before porting"
                                  >
                                    <Edit3 className="w-3 h-3" />
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center justify-end gap-1.5 pt-1 border-t border-slate-100 dark:border-slate-800 text-[11px]">
                            <button
                              onClick={() => handlePortSingleField(field.name)}
                              className="px-2 py-0.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-emerald-50 text-slate-600 hover:text-emerald-700 font-semibold flex items-center gap-1"
                            >
                              <span>Transfer this field</span>
                              <ArrowRight className="w-3 h-3" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Live Preview Canvases side-by-side */}
              <div className="pt-4 border-t border-slate-100 dark:border-slate-800 space-y-3">
                <div className="flex items-center justify-between text-xs font-bold text-slate-700 dark:text-slate-300">
                  <span>Live Visual Preview of Documents (Page {currentPage}):</span>
                  <span className="text-emerald-600 font-normal">Changes appear automatically on target canvas</span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-[460px] overflow-hidden">
                  <div className="p-3 bg-slate-100/60 dark:bg-slate-950/40 rounded-xl border flex flex-col items-center justify-center overflow-auto">
                    <span className="text-[11px] font-mono font-bold text-slate-500 mb-2">Source Document ({syncDirection === 'A_to_B' ? 'Doc A' : 'Doc B'})</span>
                    <canvas ref={canvasARef} className="rounded shadow max-w-full border bg-white" />
                  </div>

                  <div className="p-3 bg-emerald-50/40 dark:bg-slate-950/40 rounded-xl border border-emerald-200 dark:border-emerald-800 flex flex-col items-center justify-center overflow-auto">
                    <span className="text-[11px] font-mono font-bold text-emerald-700 dark:text-emerald-400 mb-2">Target Document ({syncDirection === 'A_to_B' ? 'Doc B' : 'Doc A'})</span>
                    <canvas ref={canvasBRef} className="rounded shadow max-w-full border bg-white" />
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
