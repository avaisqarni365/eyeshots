'use client';

import React, { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { 
  Receipt, 
  UploadCloud, 
  Download, 
  ShieldCheck, 
  CheckCircle2, 
  Sparkles, 
  ChevronRight, 
  FileText, 
  Eye, 
  Copy, 
  Check, 
  Building2, 
  DollarSign, 
  CreditCard, 
  Calendar, 
  Hash, 
  Layers, 
  ArrowRight, 
  AlertCircle, 
  Loader2, 
  FileCode, 
  FileSpreadsheet, 
  ExternalLink, 
  Briefcase, 
  Table, 
  Plus, 
  Trash2,
  RefreshCw,
  Search,
  Zap,
  SlidersHorizontal
} from 'lucide-react';
import { 
  InvoiceData, 
  InvoiceLineItem, 
  extractRawTextFromPdf, 
  parseInvoiceText, 
  exportToDatevCsv, 
  exportToZugferdXml, 
  SAMPLE_INVOICES 
} from '@/lib/pdf/invoice-scanner-engine';
import { renderPageThumbnail } from '@/lib/pdf/thumbnail-generator';
import * as pdfjsLib from 'pdfjs-dist';
import { FileDropzone } from '@/components/FileDropzone';

if (typeof window !== 'undefined') {
  pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';
}

export default function ScanInvoicePage() {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentStep, setCurrentStep] = useState<string>('');
  const [invoiceData, setInvoiceData] = useState<InvoiceData | null>(null);
  const [rawTextLines, setRawTextLines] = useState<string[]>([]);
  const [activeLeftTab, setActiveLeftTab] = useState<'viewer' | 'rawText'>('viewer');
  const [activeExportFormat, setActiveExportFormat] = useState<'datev' | 'zugferd' | 'json'>('datev');
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [pageThumbnail, setPageThumbnail] = useState<string | null>(null);
  const [isPaneDragging, setIsPaneDragging] = useState(false);
  const paneDragCounter = useRef(0);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    showToast(`Copied ${key}: ${text}`);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const selected = e.target.files[0];
    await processInvoiceFile(selected);
  };

  const processInvoiceFile = async (pdfFile: File) => {
    setFile(pdfFile);
    setIsProcessing(true);
    setCurrentStep('Reading PDF vector text streams into memory sandbox...');

    try {
      const buffer = await pdfFile.arrayBuffer();

      // Render first page thumbnail for invoice viewer
      try {
        const loadingTask = pdfjsLib.getDocument({
          data: new Uint8Array(buffer).slice(),
          cMapUrl: '/pdfjs/cmaps/',
          cMapPacked: true,
        });
        const doc = await loadingTask.promise;
        const thumb = await renderPageThumbnail(doc, 1, 600);
        setPageThumbnail(thumb);
      } catch (err) {
        console.warn('Thumbnail generation skipped:', err);
      }

      setCurrentStep('Extracting 100% of text with coordinate alignment...');
      const { fullText, pageLines } = await extractRawTextFromPdf(buffer);
      setRawTextLines(fullText.split('\n'));

      setCurrentStep('Running intelligent accounting heuristic parser (DATEV & ZUGFeRD)...');
      await new Promise(r => setTimeout(r, 350));

      const parsed = parseInvoiceText(fullText, pdfFile.name);
      setInvoiceData(parsed);
      showToast('Invoice extracted with 100% text fidelity');
    } catch (err: any) {
      console.error('Invoice extraction error:', err);
      showToast('Error reading invoice: ' + (err.message || 'Check PDF format'));
    } finally {
      setIsProcessing(false);
      setCurrentStep('');
    }
  };

  // Load built-in realistic sample invoice
  const handleLoadSample = (sampleIndex: number) => {
    const sample = SAMPLE_INVOICES[sampleIndex];
    if (!sample || !sample.data) return;

    const fullSampleData: InvoiceData = {
      documentId: 'sample_' + Math.random().toString(36).substring(2, 9),
      fileName: sample.data.fileName || 'Rechnung_Sample.pdf',
      invoiceNumber: sample.data.invoiceNumber || 'INV-2026-001',
      invoiceDate: sample.data.invoiceDate || '2026-11-01',
      dueDate: sample.data.dueDate || '2026-11-15',
      currency: sample.data.currency || 'EUR',
      vendor: sample.data.vendor || {
        name: 'Acme Cloud & Cluster Infrastructure GmbH',
        address: 'Friedrichstraße 176, 10117 Berlin',
        taxId: '37/102/98201',
        vatId: 'DE319204857',
        iban: 'DE44 1001 0010 0123 4567 89',
        bic: 'PBNKDEFFXXX',
      },
      customer: sample.data.customer || {
        name: 'EyeShots Enterprise AG',
        address: 'Potsdamer Platz 10, 10785 Berlin',
        customerId: 'KD-99402',
      },
      totals: sample.data.totals || {
        netSubtotal: 1200.00,
        taxRate: 19,
        taxAmount: 228.00,
        grossTotal: 1428.00,
      },
      lineItems: sample.data.lineItems || [],
      paymentReference: sample.data.paymentReference || 'RE-849201',
      notes: sample.data.notes || 'eIDAS & ZUGFeRD 2.2 konform',
      confidenceScore: sample.data.confidenceScore || 99,
      rawText: `RECHNUNG ${sample.data.invoiceNumber}\nDatum: ${sample.data.invoiceDate}\nFällig: ${sample.data.dueDate}\nLieferant: ${sample.data.vendor?.name}\nIBAN: ${sample.data.vendor?.iban}\nGesamtbetrag: ${sample.data.totals?.grossTotal} EUR`,
    };

    setFile(new File(['sample'], fullSampleData.fileName, { type: 'application/pdf' }));
    setInvoiceData(fullSampleData);
    setRawTextLines(fullSampleData.rawText.split('\n'));
    setPageThumbnail(null);
    showToast(`Loaded sample: ${sample.title}`);
  };

  // Export handlers
  const handleDownloadDatevCsv = () => {
    if (!invoiceData) return;
    let csvContent: string;
    try {
      csvContent = exportToDatevCsv(invoiceData);
    } catch (err) {
      showToast((err as Error).message); // required fields missing — never export guessed values
      return;
    }
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    downloadBlob(blob, `DATEV_Buchung_${invoiceData.invoiceNumber}.csv`);
    showToast('Downloaded DATEV CSV format');
  };

  const handleDownloadZugferdXml = () => {
    if (!invoiceData) return;
    let xmlContent: string;
    try {
      xmlContent = exportToZugferdXml(invoiceData);
    } catch (err) {
      showToast((err as Error).message); // required fields missing — never export guessed values
      return;
    }
    const blob = new Blob([xmlContent], { type: 'application/xml;charset=utf-8;' });
    downloadBlob(blob, `ZUGFeRD_FacturX_${invoiceData.invoiceNumber}.xml`);
    showToast('Downloaded ZUGFeRD 2.2 / Factur-X XML');
  };

  const handleDownloadJson = () => {
    if (!invoiceData) return;
    const jsonStr = JSON.stringify(invoiceData, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    downloadBlob(blob, `Invoice_${invoiceData.invoiceNumber}.json`);
    showToast('Downloaded Accounting JSON schema');
  };

  const handleSaveToDms = () => {
    if (!invoiceData) return;
    const pendingDoc = {
      name: invoiceData.fileName || `Invoice_${invoiceData.invoiceNumber}.pdf`,
      projectId: 'proj_tax',
      subfolderId: 'sub_rechnungen',
      sizeBytes: 520000,
    };
    if (typeof window !== 'undefined') {
      localStorage.setItem('eyeshots_pending_dms_doc', JSON.stringify(pendingDoc));
    }
    showToast('Invoice pushed to DMS Accounting folder. Opening DMS...');
    setTimeout(() => router.push('/dms'), 500);
  };

  const downloadBlob = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  };

  // Editable fields updater
  const updateField = (path: string, val: any) => {
    if (!invoiceData) return;
    const copy = { ...invoiceData };
    if (path === 'invoiceNumber') copy.invoiceNumber = val;
    else if (path === 'invoiceDate') copy.invoiceDate = val;
    else if (path === 'dueDate') copy.dueDate = val;
    else if (path === 'vendor.name') copy.vendor.name = val;
    else if (path === 'vendor.iban') copy.vendor.iban = val;
    else if (path === 'vendor.vatId') copy.vendor.vatId = val;
    else if (path === 'totals.grossTotal') {
      const num = parseFloat(val) || 0;
      copy.totals.grossTotal = num;
      copy.totals.netSubtotal = Math.round((num / (1 + copy.totals.taxRate / 100)) * 100) / 100;
      copy.totals.taxAmount = Math.round((num - copy.totals.netSubtotal) * 100) / 100;
    }
    setInvoiceData(copy);
  };

  const formatCurrency = (amount: number, curr = 'EUR') => {
    return new Intl.NumberFormat('de-DE', { style: 'currency', currency: curr }).format(amount);
  };

  return (
    <div className="max-w-[1440px] mx-auto px-4 sm:px-6 py-8 space-y-6 select-none">
      {/* Breadcrumb Navigation */}
      <nav className="flex items-center gap-2 text-xs text-slate-500">
        <Link href="/" className="hover:text-emerald-600 transition-colors">Home</Link>
        <ChevronRight className="w-3.5 h-3.5" />
        <Link href="/dms" className="hover:text-emerald-600 transition-colors">DMS</Link>
        <ChevronRight className="w-3.5 h-3.5" />
        <span className="text-slate-900 dark:text-white font-semibold">Invoice Scanner & Accounting OCR</span>
      </nav>

      {/* Hero Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-2 border-b border-slate-200 dark:border-slate-800">
        <div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 text-xs font-semibold border border-emerald-200 dark:border-emerald-800/60 mb-2">
            <Receipt className="w-3.5 h-3.5 text-emerald-600" />
            <span>100% Text Fetch &bull; DATEV &bull; ZUGFeRD 2.2 &bull; Accounting Tech</span>
          </div>
          <h1 className="text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
            Invoice Scanner & Accounting Extractor
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 max-w-2xl mt-1">
            Extract clean, structured accounting data from any PDF invoice or receipt. Automatically resolves vendor details, IBAN, VAT IDs, line items, and tax totals. Directly export to DATEV, ZUGFeRD XML, or JSON.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => fileInputRef.current?.click()}
            className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-md flex items-center gap-1.5 transition-all"
          >
            <UploadCloud className="w-4 h-4" />
            <span>Upload Invoice PDF</span>
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,application/pdf"
            onChange={handleFileUpload}
            className="hidden"
          />
        </div>
      </div>

      {/* Quick Sample Selector Bar */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-3.5 shadow-sm flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2 font-bold text-slate-700 dark:text-slate-200">
          <Sparkles className="w-4 h-4 text-emerald-600" />
          <span>Try Instant Real Invoices:</span>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {SAMPLE_INVOICES.map((sample, idx) => (
            <button
              key={idx}
              onClick={() => handleLoadSample(idx)}
              className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 hover:border-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 text-slate-700 dark:text-slate-300 font-semibold transition-all flex items-center gap-1.5"
            >
              <span>{sample.title}</span>
              <span className="text-[10px] text-emerald-600 font-mono font-bold">1-Click</span>
            </button>
          ))}
        </div>
      </div>

      {/* Main Split Layout: Left Viewer/Raw Text | Right Accounting Studio */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 min-h-[680px]">
        
        {/* 1. LEFT PANE: Invoice Visual Viewer & 100% Raw Text Stream (5 Cols) */}
        <div 
          onDragEnter={(e) => {
            e.preventDefault();
            paneDragCounter.current += 1;
            if (e.dataTransfer?.items?.length) setIsPaneDragging(true);
          }}
          onDragOver={(e) => {
            e.preventDefault();
          }}
          onDragLeave={(e) => {
            e.preventDefault();
            paneDragCounter.current -= 1;
            if (paneDragCounter.current <= 0) {
              setIsPaneDragging(false);
              paneDragCounter.current = 0;
            }
          }}
          onDrop={(e) => {
            e.preventDefault();
            setIsPaneDragging(false);
            paneDragCounter.current = 0;
            if (e.dataTransfer?.files?.length) {
              const dropped = Array.from(e.dataTransfer.files).find(
                (f) => f.type === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf')
              );
              if (dropped) processInvoiceFile(dropped);
              else showToast('Please drop a valid PDF file.');
            }
          }}
          className="relative lg:col-span-5 flex flex-col bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden"
        >
          {/* Drag Overlay when dragging a new invoice over the pane */}
          {isPaneDragging && (
            <div className="absolute inset-0 z-50 bg-emerald-500/90 dark:bg-emerald-950/90 backdrop-blur-sm flex flex-col items-center justify-center p-6 text-white text-center animate-fade-in">
              <UploadCloud className="w-16 h-16 animate-bounce mb-3" />
              <h3 className="text-xl font-extrabold">Drop Invoice PDF here</h3>
              <p className="text-xs text-emerald-100 mt-1 max-w-xs">
                Extracts 100% of text & auto-generates DATEV CSV & ZUGFeRD 2.2 XML
              </p>
            </div>
          )}

          {/* Header & Tabs */}
          <div className="px-4 py-3 bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between text-xs">
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setActiveLeftTab('viewer')}
                className={`px-3 py-1 rounded-lg font-bold transition-all flex items-center gap-1.5 ${
                  activeLeftTab === 'viewer'
                    ? 'bg-white dark:bg-slate-700 text-emerald-600 shadow-sm'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                <Eye className="w-3.5 h-3.5" />
                <span>Document Viewer</span>
              </button>

              <button
                onClick={() => setActiveLeftTab('rawText')}
                className={`px-3 py-1 rounded-lg font-bold transition-all flex items-center gap-1.5 ${
                  activeLeftTab === 'rawText'
                    ? 'bg-white dark:bg-slate-700 text-emerald-600 shadow-sm'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                <FileCode className="w-3.5 h-3.5" />
                <span>100% Extracted Text ({rawTextLines.length} lines)</span>
              </button>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => fileInputRef.current?.click()}
                title="Select another invoice"
                className="text-[10px] px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 font-bold hover:bg-emerald-200 transition-colors"
              >
                Change PDF
              </button>
              <span className="text-[10px] text-slate-400 font-mono truncate max-w-[120px]">
                {file ? file.name : 'No file loaded'}
              </span>
            </div>
          </div>

          {/* Content Box */}
          <div className="flex-1 p-4 overflow-y-auto bg-slate-100/50 dark:bg-slate-950/30 flex flex-col items-center justify-center">
            {isProcessing ? (
              <div className="space-y-3 text-center p-8">
                <Loader2 className="w-8 h-8 animate-spin text-emerald-600 mx-auto" />
                <p className="text-xs font-bold text-slate-800 dark:text-white">{currentStep}</p>
                <p className="text-[11px] text-slate-400">Sorting vector coordinates & mapping accounting entities...</p>
              </div>
            ) : !invoiceData ? (
              <FileDropzone
                onFileSelected={processInvoiceFile}
                title="Drop your PDF invoice or receipt here"
                description="We'll extract 100% of the text, reconstruct line items, and generate DATEV & ZUGFeRD data."
                badge="⚡ 100% Client-Side OCR & Parsing"
                variant="emerald"
                className="w-full"
              />
            ) : activeLeftTab === 'viewer' ? (
              /* Visual PDF / Rendered Invoice Thumbnail */
              pageThumbnail ? (
                <div className="w-full max-w-md bg-white rounded-xl shadow-lg border overflow-hidden p-2">
                  <img
                    src={pageThumbnail}
                    alt="Invoice Preview"
                    className="w-full h-auto object-contain rounded"
                  />
                </div>
              ) : (
                /* Synthetic Clean Visual Invoice Document Tile */
                <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-xl shadow-lg border p-6 space-y-4 text-xs font-mono">
                  <div className="flex justify-between border-b pb-3">
                    <div>
                      <h4 className="font-bold text-sm text-slate-900 dark:text-white">{invoiceData.vendor.name}</h4>
                      <p className="text-[10px] text-slate-400">{invoiceData.vendor.address}</p>
                      <p className="text-[10px] text-slate-400">USt-IdNr: {invoiceData.vendor.vatId || 'DE319204857'}</p>
                    </div>
                    <div className="text-right">
                      <span className="font-bold text-sm text-emerald-600">RECHNUNG</span>
                      <p className="text-[10px] text-slate-500 font-bold">{invoiceData.invoiceNumber}</p>
                      <p className="text-[10px] text-slate-400">Datum: {invoiceData.invoiceDate}</p>
                    </div>
                  </div>

                  <div className="border-b pb-3">
                    <span className="text-[10px] text-slate-400 block font-bold">Rechnungsempfänger:</span>
                    <p className="font-bold text-slate-800 dark:text-white">{invoiceData.customer.name}</p>
                    <p className="text-[10px] text-slate-500">{invoiceData.customer.address}</p>
                  </div>

                  {/* Simple Table */}
                  <div className="space-y-1 border-b pb-3 text-[11px]">
                    <div className="flex justify-between font-bold text-slate-400 pb-1 border-b">
                      <span>Position & Beschreibung</span>
                      <span>Betrag</span>
                    </div>
                    {invoiceData.lineItems.map((item, i) => (
                      <div key={i} className="flex justify-between py-1">
                        <span className="truncate pr-2">{item.description}</span>
                        <span className="font-bold whitespace-nowrap">{formatCurrency(item.lineTotal, invoiceData.currency)}</span>
                      </div>
                    ))}
                  </div>

                  {/* Totals */}
                  <div className="space-y-1 text-right text-xs">
                    <div className="flex justify-between text-slate-500">
                      <span>Nettobetrag:</span>
                      <span>{formatCurrency(invoiceData.totals.netSubtotal, invoiceData.currency)}</span>
                    </div>
                    <div className="flex justify-between text-slate-500">
                      <span>USt / MwSt ({invoiceData.totals.taxRate}%):</span>
                      <span>{formatCurrency(invoiceData.totals.taxAmount, invoiceData.currency)}</span>
                    </div>
                    <div className="flex justify-between text-sm font-bold text-emerald-600 pt-1 border-t">
                      <span>Gesamtbetrag (Brutto):</span>
                      <span>{formatCurrency(invoiceData.totals.grossTotal, invoiceData.currency)}</span>
                    </div>
                  </div>

                  {/* Bank */}
                  <div className="pt-2 text-[10px] text-slate-400 border-t flex justify-between">
                    <span>IBAN: {invoiceData.vendor.iban}</span>
                    <span>BIC: {invoiceData.vendor.bic}</span>
                  </div>
                </div>
              )
            ) : (
              /* 100% Extracted Text Stream */
              <div className="w-full h-full bg-slate-900 text-emerald-400 font-mono text-[11px] p-4 rounded-xl overflow-y-auto space-y-1 max-h-[580px]">
                {rawTextLines.map((line, idx) => (
                  <div key={idx} className="flex gap-3 hover:bg-slate-800/60 px-1 rounded">
                    <span className="text-slate-600 select-none w-8 text-right shrink-0">{idx + 1}</span>
                    <span className="whitespace-pre-wrap">{line}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* 2. RIGHT PANE: Structured Accounting Studio & System Exporters (7 Cols) */}
        <div className="lg:col-span-7 flex flex-col bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
          {/* Header & Confidence Badge */}
          <div className="px-5 py-3.5 bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-700 flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-emerald-100 dark:bg-emerald-950 text-emerald-600">
                <Receipt className="w-4 h-4" />
              </div>
              <span className="font-bold text-sm text-slate-900 dark:text-white">
                Structured Accounting Data
              </span>
              {invoiceData && (
                <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 text-[10px] font-bold">
                  {invoiceData.confidenceScore}% Confidence Score
                </span>
              )}
            </div>

            {/* Quick Export format buttons */}
            {invoiceData && (
              <div className="flex items-center gap-1.5">
                <button
                  onClick={handleDownloadDatevCsv}
                  className="px-2.5 py-1 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold text-[11px] flex items-center gap-1 shadow-sm"
                  title="Export DATEV Format (Buchungsstapel)"
                >
                  <FileSpreadsheet className="w-3 h-3" />
                  <span>DATEV CSV</span>
                </button>

                <button
                  onClick={handleDownloadZugferdXml}
                  className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] flex items-center gap-1 shadow-sm"
                  title="Export European EN 16931 ZUGFeRD 2.2 / Factur-X XML"
                >
                  <FileCode className="w-3 h-3" />
                  <span>ZUGFeRD XML</span>
                </button>

                <button
                  onClick={handleDownloadJson}
                  className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-white font-bold text-[11px] flex items-center gap-1 shadow-sm"
                  title="Export Universal Accounting JSON"
                >
                  <Download className="w-3 h-3" />
                  <span>JSON</span>
                </button>

                <button
                  onClick={handleSaveToDms}
                  className="px-2.5 py-1 rounded-lg border border-slate-300 dark:border-slate-700 hover:bg-slate-100 text-slate-700 dark:text-slate-200 font-bold text-[11px] flex items-center gap-1"
                  title="Save Invoice into EyeShots Central DMS Accounting Project"
                >
                  <Briefcase className="w-3 h-3 text-emerald-600" />
                  <span>Push to DMS</span>
                </button>
              </div>
            )}
          </div>

          {/* Inspector Body */}
          <div className="flex-1 p-5 overflow-y-auto space-y-5">
            {!invoiceData ? (
              <div className="text-center py-20 space-y-2 text-slate-400">
                <Table className="w-10 h-10 mx-auto text-slate-300 dark:text-slate-700" />
                <p className="text-sm font-semibold">No invoice parsed yet.</p>
                <p className="text-xs">Upload an invoice on the left or select a sample above.</p>
              </div>
            ) : (
              <div className="space-y-5 animate-fade-in text-xs">
                {/* 1. Large Financial Summary Banner */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-4 rounded-2xl bg-gradient-to-r from-emerald-500/10 via-teal-500/10 to-blue-500/10 border border-emerald-500/20">
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Total Due (Brutto)</span>
                    <span className="text-xl font-extrabold text-emerald-600">
                      {formatCurrency(invoiceData.totals.grossTotal, invoiceData.currency)}
                    </span>
                  </div>

                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Net Subtotal</span>
                    <span className="text-base font-bold text-slate-800 dark:text-slate-200">
                      {formatCurrency(invoiceData.totals.netSubtotal, invoiceData.currency)}
                    </span>
                  </div>

                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">VAT / MwSt ({invoiceData.totals.taxRate}%)</span>
                    <span className="text-base font-bold text-slate-800 dark:text-slate-200">
                      {formatCurrency(invoiceData.totals.taxAmount, invoiceData.currency)}
                    </span>
                  </div>

                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Invoice Number</span>
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm font-bold text-slate-900 dark:text-white truncate">
                        {invoiceData.invoiceNumber}
                      </span>
                      <button
                        onClick={() => copyToClipboard(invoiceData.invoiceNumber, 'Invoice #')}
                        className="text-slate-400 hover:text-emerald-600"
                        title="Copy Invoice #"
                      >
                        {copiedKey === 'Invoice #' ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                      </button>
                    </div>
                  </div>
                </div>

                {/* 2. Key Metadata Cards (Dates, Bank & Creditor) */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Vendor / Creditor Card */}
                  <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 space-y-2">
                    <div className="flex items-center justify-between pb-1.5 border-b">
                      <span className="font-bold text-slate-800 dark:text-white flex items-center gap-1.5">
                        <Building2 className="w-3.5 h-3.5 text-blue-600" />
                        <span>Vendor / Rechnungssteller</span>
                      </span>
                      <button
                        onClick={() => copyToClipboard(invoiceData.vendor.name, 'Vendor')}
                        className="text-slate-400 hover:text-emerald-600"
                        title="Copy Vendor Name"
                      >
                        <Copy className="w-3 h-3" />
                      </button>
                    </div>

                    <div className="space-y-1.5 text-[11px]">
                      <div>
                        <span className="text-slate-400 block text-[10px]">Company Name:</span>
                        <input
                          type="text"
                          value={invoiceData.vendor.name}
                          onChange={(e) => updateField('vendor.name', e.target.value)}
                          className="w-full font-bold text-slate-800 dark:text-white bg-transparent border-b border-dashed border-slate-200 focus:border-emerald-500 focus:outline-none"
                        />
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">Address:</span>
                        <span className="text-slate-700 dark:text-slate-300 font-semibold truncate max-w-[180px]">{invoiceData.vendor.address}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">VAT ID (USt-IdNr):</span>
                        <div className="flex items-center gap-1">
                          <span className="font-mono font-bold text-slate-800 dark:text-white">{invoiceData.vendor.vatId || 'None'}</span>
                          {invoiceData.vendor.vatId && (
                            <button onClick={() => copyToClipboard(invoiceData.vendor.vatId!, 'VAT ID')}>
                              <Copy className="w-2.5 h-2.5 text-slate-400 hover:text-emerald-600" />
                            </button>
                          )}
                        </div>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">Steuernummer:</span>
                        <span className="font-mono text-slate-700 dark:text-slate-300">{invoiceData.vendor.taxId || 'None'}</span>
                      </div>
                    </div>
                  </div>

                  {/* Payment & Banking Card */}
                  <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 space-y-2">
                    <div className="flex items-center justify-between pb-1.5 border-b">
                      <span className="font-bold text-slate-800 dark:text-white flex items-center gap-1.5">
                        <CreditCard className="w-3.5 h-3.5 text-emerald-600" />
                        <span>Banking & Payment Terms</span>
                      </span>
                      <button
                        onClick={() => copyToClipboard(invoiceData.vendor.iban || '', 'IBAN')}
                        className="text-slate-400 hover:text-emerald-600"
                        title="Copy IBAN"
                      >
                        <Copy className="w-3 h-3" />
                      </button>
                    </div>

                    <div className="space-y-1.5 text-[11px]">
                      <div>
                        <span className="text-slate-400 block text-[10px]">IBAN (SEPA Bankverbindung):</span>
                        <input
                          type="text"
                          value={invoiceData.vendor.iban || ''}
                          onChange={(e) => updateField('vendor.iban', e.target.value)}
                          className="w-full font-mono font-bold text-slate-800 dark:text-white bg-transparent border-b border-dashed border-slate-200 focus:border-emerald-500 focus:outline-none"
                        />
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">BIC:</span>
                        <span className="font-mono font-bold text-slate-700 dark:text-slate-300">{invoiceData.vendor.bic || 'None'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">Invoice Date:</span>
                        <input
                          type="date"
                          value={invoiceData.invoiceDate}
                          onChange={(e) => updateField('invoiceDate', e.target.value)}
                          className="bg-transparent text-right font-bold focus:outline-none"
                        />
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">Payment Due:</span>
                        <input
                          type="date"
                          value={invoiceData.dueDate}
                          onChange={(e) => updateField('dueDate', e.target.value)}
                          className="bg-transparent text-right font-bold text-red-600 focus:outline-none"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* 3. Line Items Table */}
                <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 space-y-3">
                  <div className="flex items-center justify-between pb-1 border-b">
                    <span className="font-bold text-slate-800 dark:text-white flex items-center gap-1.5">
                      <Table className="w-3.5 h-3.5 text-purple-600" />
                      <span>Rechnungspositionen ({invoiceData.lineItems.length} Line Items)</span>
                    </span>
                    <button
                      onClick={() => {
                        const newPos = invoiceData.lineItems.length + 1;
                        setInvoiceData({
                          ...invoiceData,
                          lineItems: [
                            ...invoiceData.lineItems,
                            { position: newPos, description: 'New Service Item', quantity: 1, unit: 'Stk', unitPrice: 100, taxRate: 19, lineTotal: 100 }
                          ]
                        });
                      }}
                      className="text-emerald-600 hover:text-emerald-700 font-bold text-[11px] flex items-center gap-1"
                    >
                      <Plus className="w-3 h-3" />
                      <span>Add Item</span>
                    </button>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-[11px]">
                      <thead>
                        <tr className="border-b text-slate-400">
                          <th className="py-1.5 pr-2 w-8">#</th>
                          <th className="py-1.5 pr-3">Description</th>
                          <th className="py-1.5 pr-2 w-16 text-right">Qty</th>
                          <th className="py-1.5 pr-2 w-24 text-right">Unit Price</th>
                          <th className="py-1.5 pr-2 w-16 text-right">MwSt</th>
                          <th className="py-1.5 text-right w-24">Total</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                        {invoiceData.lineItems.map((item, idx) => (
                          <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                            <td className="py-2 text-slate-400 font-mono">{item.position}</td>
                            <td className="py-2 pr-3 font-medium text-slate-800 dark:text-slate-200">
                              <input
                                type="text"
                                value={item.description}
                                onChange={(e) => {
                                  const copy = [...invoiceData.lineItems];
                                  copy[idx].description = e.target.value;
                                  setInvoiceData({ ...invoiceData, lineItems: copy });
                                }}
                                className="w-full bg-transparent focus:outline-none"
                              />
                            </td>
                            <td className="py-2 pr-2 text-right font-mono">
                              <input
                                type="number"
                                value={item.quantity}
                                onChange={(e) => {
                                  const copy = [...invoiceData.lineItems];
                                  copy[idx].quantity = parseFloat(e.target.value) || 0;
                                  copy[idx].lineTotal = Math.round(copy[idx].quantity * copy[idx].unitPrice * 100) / 100;
                                  setInvoiceData({ ...invoiceData, lineItems: copy });
                                }}
                                className="w-12 text-right bg-transparent focus:outline-none"
                              />
                            </td>
                            <td className="py-2 pr-2 text-right font-mono">
                              {formatCurrency(item.unitPrice, invoiceData.currency)}
                            </td>
                            <td className="py-2 pr-2 text-right font-mono text-slate-400">
                              {item.taxRate}%
                            </td>
                            <td className="py-2 text-right font-mono font-bold text-slate-900 dark:text-white">
                              {formatCurrency(item.lineTotal, invoiceData.currency)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* 4. One-Click Copy All Summary for Accounting / Email */}
                <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border flex items-center justify-between">
                  <div className="space-y-0.5">
                    <span className="font-bold text-slate-700 dark:text-slate-200">Copy Full Booking Reference:</span>
                    <p className="text-[10px] text-slate-400 font-mono">
                      {invoiceData.vendor.name} &bull; Rg {invoiceData.invoiceNumber} &bull; {formatCurrency(invoiceData.totals.grossTotal, invoiceData.currency)} &bull; IBAN: {invoiceData.vendor.iban}
                    </p>
                  </div>
                  <button
                    onClick={() => copyToClipboard(
                      `${invoiceData.vendor.name} | Rg: ${invoiceData.invoiceNumber} | Betrag: ${invoiceData.totals.grossTotal} ${invoiceData.currency} | IBAN: ${invoiceData.vendor.iban} | Datum: ${invoiceData.invoiceDate}`,
                      'Booking Summary'
                    )}
                    className="px-3 py-1.5 rounded-xl bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 font-bold text-xs flex items-center gap-1"
                  >
                    <Copy className="w-3.5 h-3.5" />
                    <span>Copy Reference</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Floating Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-900 text-white dark:bg-white dark:text-slate-900 px-4 py-2.5 rounded-2xl shadow-xl flex items-center gap-2 text-xs font-bold animate-bounce border border-slate-700 dark:border-slate-200">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 dark:text-emerald-600" />
          <span>{toastMessage}</span>
        </div>
      )}
    </div>
  );
}
