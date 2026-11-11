'use client';

import React, { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { 
  ScanText, 
  UploadCloud, 
  Download, 
  ShieldCheck, 
  Cpu, 
  AlertCircle, 
  Loader2, 
  ChevronRight, 
  FileCheck,
  Languages,
  Copy,
  Check,
  FileText,
  Eye,
  Edit3,
  ExternalLink,
  Sparkles,
  RefreshCw,
  FileCode
} from 'lucide-react';
import { ocrPdfServer, downloadFileBlob } from '@/lib/api/gateway-client';
import { convertPdfToMarkdown } from '@/lib/pdf/pdf-to-markdown';
import { renderPageThumbnail } from '@/lib/pdf/thumbnail-generator';
import { marked } from 'marked';
import * as pdfjsLib from 'pdfjs-dist';

if (typeof window !== 'undefined') {
  pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';
}

export default function OcrPdfPage() {
  const [file, setFile] = useState<File | null>(null);
  const [language, setLanguage] = useState<string>('eng');
  const [isProcessing, setIsProcessing] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Markdown extraction state
  const [markdownText, setMarkdownText] = useState<string>('');
  const [htmlPreview, setHtmlPreview] = useState<string>('');
  const [pageCount, setPageCount] = useState<number>(0);
  const [wordCount, setWordCount] = useState<number>(0);
  const [isScannedScan, setIsScannedScan] = useState<boolean>(false);
  const [copied, setCopied] = useState<boolean>(false);
  const [activeViewTab, setActiveViewTab] = useState<'preview' | 'source'>('preview');

  // Thumbnail state
  const [thumbnails, setThumbnails] = useState<Record<number, string>>({});
  const [selectedPageNum, setSelectedPageNum] = useState<number>(1);

  // Searchable OCR PDF blob state
  const [searchablePdfBlob, setSearchablePdfBlob] = useState<Blob | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Parse markdown to HTML
  useEffect(() => {
    if (markdownText) {
      try {
        const rendered = marked.parse(markdownText, { gfm: true, breaks: true }) as string;
        setHtmlPreview(rendered);
      } catch (e) {
        console.error('Markdown parse error:', e);
      }
    } else {
      setHtmlPreview('');
    }
  }, [markdownText]);

  // Load document and extract markdown
  const processDocument = async (selectedFile: File) => {
    setFile(selectedFile);
    setIsProcessing(true);
    setStatusMessage('Analyzing document layout and extracting text to Markdown...');
    setError(null);
    setSearchablePdfBlob(null);

    try {
      // 1. Extract thumbnails for visual viewer
      const buffer = await selectedFile.arrayBuffer();
      const loadingTask = pdfjsLib.getDocument({
        data: new Uint8Array(buffer).slice(),
        cMapUrl: '/pdfjs/cmaps/',
        cMapPacked: true,
      });
      const doc = await loadingTask.promise;
      const total = doc.numPages;
      setPageCount(total);

      const thumbs: Record<number, string> = {};
      for (let i = 1; i <= Math.min(total, 6); i++) {
        try {
          thumbs[i] = await renderPageThumbnail(doc, i, 160);
        } catch (e) {
          console.warn('Thumbnail err:', e);
        }
      }
      setThumbnails(thumbs);

      // 2. Convert to structured Markdown
      const { markdown, pageCount: count, wordCount: words } = await convertPdfToMarkdown(buffer);
      setMarkdownText(markdown);
      setWordCount(words);

      // Heuristic: If average words per page is less than 15, it is likely a pure scanned image
      if (words / Math.max(1, count) < 15) {
        setIsScannedScan(true);
        setStatusMessage('Detected scanned image PDF with minimal text layer. Run Deep Tesseract OCR below to extract full text.');
      } else {
        setIsScannedScan(false);
        setStatusMessage(`Successfully reconstructed ${words} words across ${count} pages into Markdown!`);
      }
    } catch (err: any) {
      console.error(err);
      setError('Failed to process PDF: ' + (err.message || 'Unknown error'));
    } finally {
      setIsProcessing(false);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const selected = e.target.files[0];

    if (!selected.name.toLowerCase().endsWith('.pdf')) {
      setError('Please select a valid PDF file.');
      return;
    }

    processDocument(selected);
  };

  // Run Server-Side Tesseract OCR via Stirling Engine
  const handleDeepOcr = async () => {
    if (!file) return;

    setIsProcessing(true);
    setStatusMessage(`Running Tesseract 5 OCR with language "${language}" and auto-deskew...`);
    setError(null);

    try {
      const ocrBlob = await ocrPdfServer(file, { languages: language }, (p) => setStatusMessage(`OCR: ${p.message}`));
      setSearchablePdfBlob(ocrBlob);

      // Convert newly OCR'd searchable PDF to Markdown
      setStatusMessage('OCR complete! Reconstructing newly generated text layer into Markdown...');
      const ocrBuffer = await ocrBlob.arrayBuffer();
      const { markdown, wordCount: words } = await convertPdfToMarkdown(ocrBuffer);
      setMarkdownText(markdown);
      setWordCount(words);
      setIsScannedScan(false);
      setStatusMessage(`OCR successful! Extracted ${words} words into full Markdown.`);
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'OCR processing failed on server.');
    } finally {
      setIsProcessing(false);
    }
  };

  const copyMarkdown = () => {
    navigator.clipboard.writeText(markdownText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const downloadMarkdownFile = () => {
    const blob = new Blob([markdownText], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${file?.name.replace(/\.pdf$/i, '') || 'document'}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  };

  const downloadSearchablePdf = () => {
    if (!searchablePdfBlob || !file) return;
    downloadFileBlob(searchablePdfBlob, file.name.replace(/\.pdf$/i, '-ocr-searchable.pdf'));
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6 select-none">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-xs text-slate-500">
        <Link href="/" className="hover:text-indigo-600">Home</Link>
        <ChevronRight className="w-3.5 h-3.5" />
        <span className="text-slate-900 dark:text-white font-medium">OCR & PDF to Markdown</span>
      </nav>

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 text-xs font-semibold border border-indigo-200 dark:border-indigo-800/60 mb-2">
            <Cpu className="w-3.5 h-3.5 text-indigo-500" />
            Tesseract 5 OCR &bull; Full Structure & Typography to Markdown (.md)
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white">
            PDF to Markdown (.md) & Optical Character Recognition
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 max-w-xl">
            Convert any PDF or scanned document into a clean, formatted GitHub Markdown file with recognized headings, tables, and lists.
          </p>
        </div>

        {file && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => { setFile(null); setMarkdownText(''); }}
              className="px-3 py-1.5 rounded-xl border border-slate-200 hover:bg-slate-100 text-xs text-slate-700 dark:text-slate-300 font-semibold"
            >
              Change PDF
            </button>
            <Link
              href="/markdown-pdf"
              className="px-3.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-200 flex items-center gap-1.5"
            >
              <ExternalLink className="w-3.5 h-3.5 text-sky-600" />
              <span>Open in Markdown Studio</span>
            </Link>
          </div>
        )}
      </div>

      {/* Status & Error Alerts */}
      {statusMessage && (
        <div className="p-3.5 rounded-2xl bg-indigo-50/80 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800/50 text-indigo-900 dark:text-indigo-200 text-xs flex items-center justify-between animate-fade-in">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-indigo-600 shrink-0" />
            <span>{statusMessage}</span>
          </div>
          {isScannedScan && (
            <button
              onClick={handleDeepOcr}
              disabled={isProcessing}
              className="px-3 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow shrink-0"
            >
              Run Tesseract OCR Now
            </button>
          )}
        </div>
      )}

      {error && (
        <div className="p-3.5 rounded-2xl bg-red-50 dark:bg-red-950/40 border border-red-200 text-red-700 text-xs flex items-center gap-2 animate-fade-in">
          <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {!file ? (
        <div
          onClick={() => fileInputRef.current?.click()}
          className="group relative border-2 border-dashed border-indigo-300 dark:border-indigo-700/80 hover:border-indigo-500 rounded-3xl p-10 sm:p-14 text-center cursor-pointer bg-white/70 dark:bg-slate-900/70 hover:bg-indigo-50/40 dark:hover:bg-indigo-950/20 transition-all shadow-sm"
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,application/pdf"
            onChange={handleFileSelect}
            className="hidden"
          />

          <div className="flex flex-col items-center gap-3">
            <div className="w-16 h-16 rounded-2xl bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 flex items-center justify-center group-hover:scale-110 transition-transform shadow-md shadow-indigo-500/10">
              <ScanText className="w-8 h-8" />
            </div>
            <div>
              <span className="text-base font-bold text-slate-800 dark:text-slate-100">
                Click to select any PDF for OCR & Markdown conversion
              </span>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Converts vector PDFs or scanned documents into clean, structured Markdown (.md)
              </p>
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Operations & Metadata Toolbar */}
          <div className="flex flex-wrap items-center justify-between gap-3 p-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
            <div className="flex items-center gap-3">
              <FileCheck className="w-6 h-6 text-indigo-600" />
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white truncate max-w-xs sm:max-w-md">
                  {file.name}
                </h3>
                <p className="text-xs text-slate-400">
                  {pageCount} pages &bull; {wordCount} words detected &bull; {markdownText.length} characters
                </p>
              </div>
            </div>

            {/* OCR Language & Action Buttons */}
            <div className="flex items-center gap-2 flex-wrap text-xs">
              <div className="flex items-center gap-1.5 bg-slate-50 dark:bg-slate-800 border rounded-xl px-2.5 py-1">
                <Languages className="w-3.5 h-3.5 text-slate-500" />
                <span className="text-slate-500 font-semibold">OCR Lang:</span>
                <select
                  value={language}
                  onChange={(e) => setLanguage(e.target.value)}
                  className="bg-transparent font-bold text-slate-800 dark:text-white focus:outline-none cursor-pointer"
                >
                  <option value="eng">English (eng)</option>
                  <option value="spa">Spanish (spa)</option>
                  <option value="deu">German (deu)</option>
                  <option value="fra">French (fra)</option>
                  <option value="ita">Italian (ita)</option>
                  <option value="por">Portuguese (por)</option>
                  <option value="ara">Arabic (ara)</option>
                  <option value="chi_sim">Chinese (chi_sim)</option>
                  <option value="jpn">Japanese (jpn)</option>
                </select>
              </div>

              <button
                onClick={handleDeepOcr}
                disabled={isProcessing}
                className="px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-bold flex items-center gap-1.5 shadow"
                title="Run deep Tesseract OCR with deskew and noise cleaning"
              >
                {isProcessing ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Cpu className="w-3.5 h-3.5" />
                )}
                <span>Run Deep OCR</span>
              </button>

              <button
                onClick={copyMarkdown}
                className="px-3 py-2 rounded-xl border border-slate-200 hover:bg-slate-100 font-semibold flex items-center gap-1.5 text-slate-700 dark:text-slate-300"
              >
                {copied ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-600" />
                    <span className="text-emerald-600">Copied!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5 text-slate-500" />
                    <span>Copy .md</span>
                  </>
                )}
              </button>

              <button
                onClick={downloadMarkdownFile}
                className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold flex items-center gap-1.5 shadow"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Download .md</span>
              </button>

              {searchablePdfBlob && (
                <button
                  onClick={downloadSearchablePdf}
                  className="px-3.5 py-2 rounded-xl border border-indigo-200 hover:bg-indigo-50 dark:hover:bg-indigo-950 font-bold text-indigo-700 dark:text-indigo-300 flex items-center gap-1.5"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download Searchable PDF</span>
                </button>
              )}
            </div>
          </div>

          {/* Dual-Pane Studio: PDF Preview (Left) & Markdown Output (Right) */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 h-[700px]">
            {/* Left Pane: PDF Page Thumbnails / Document Navigation (5 cols) */}
            <div className="lg:col-span-5 flex flex-col bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
              <div className="px-4 py-2.5 bg-slate-50 dark:bg-slate-800/60 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between text-[11px] text-slate-500 font-bold uppercase tracking-wider">
                <span>Original PDF Document</span>
                <span>{pageCount} Pages</span>
              </div>

              <div className="flex-1 p-4 overflow-y-auto space-y-4 bg-slate-100/40 dark:bg-slate-950/40">
                {Array.from({ length: pageCount }).map((_, idx) => {
                  const pageNum = idx + 1;
                  return (
                    <div
                      key={pageNum}
                      className="bg-white dark:bg-slate-800 rounded-xl p-2.5 border border-slate-200 dark:border-slate-700 shadow-sm space-y-1.5"
                    >
                      <div className="flex justify-between items-center text-[10px] font-bold text-slate-500 px-1">
                        <span>Page {pageNum}</span>
                        <span className="text-indigo-600">Original</span>
                      </div>
                      <div className="w-full aspect-[3/4] bg-slate-50 dark:bg-slate-900 rounded overflow-hidden flex items-center justify-center">
                        {thumbnails[pageNum] ? (
                          <img
                            src={thumbnails[pageNum]}
                            alt={`Page ${pageNum}`}
                            className="w-full h-full object-contain"
                          />
                        ) : (
                          <div className="flex flex-col items-center text-slate-400 text-xs">
                            <Loader2 className="w-4 h-4 animate-spin mb-1 text-indigo-500" />
                            <span>Page {pageNum}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Right Pane: Generated Markdown Studio (7 cols) */}
            <div className="lg:col-span-7 flex flex-col bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
              {/* Header Tab Switcher */}
              <div className="px-4 py-2 bg-slate-50 dark:bg-slate-800/60 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs font-semibold">
                <div className="flex items-center gap-1 bg-slate-200/60 dark:bg-slate-700 p-0.5 rounded-lg">
                  <button
                    onClick={() => setActiveViewTab('preview')}
                    className={`px-3 py-1 rounded text-xs transition-all ${
                      activeViewTab === 'preview'
                        ? 'bg-white dark:bg-slate-800 text-indigo-700 dark:text-indigo-300 font-bold shadow-sm'
                        : 'text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    Formatted Preview
                  </button>
                  <button
                    onClick={() => setActiveViewTab('source')}
                    className={`px-3 py-1 rounded text-xs transition-all ${
                      activeViewTab === 'source'
                        ? 'bg-white dark:bg-slate-800 text-indigo-700 dark:text-indigo-300 font-bold shadow-sm'
                        : 'text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    Raw Markdown (.md)
                  </button>
                </div>

                <div className="text-[11px] text-slate-400 font-mono">
                  {wordCount} words &bull; {markdownText.split('\n').length} lines
                </div>
              </div>

              {/* View 1: Formatted HTML Reader Preview */}
              {activeViewTab === 'preview' ? (
                <div className="flex-1 p-6 overflow-y-auto prose dark:prose-invert max-w-none text-slate-800 dark:text-slate-200 text-xs sm:text-sm leading-relaxed">
                  <div dangerouslySetInnerHTML={{ __html: htmlPreview }} />
                </div>
              ) : (
                /* View 2: Raw Editable Markdown Textarea */
                <textarea
                  value={markdownText}
                  onChange={(e) => setMarkdownText(e.target.value)}
                  className="flex-1 p-4 font-mono text-xs sm:text-sm bg-transparent resize-none focus:outline-none leading-relaxed text-slate-800 dark:text-slate-200"
                  placeholder="Extracted Markdown text will appear here..."
                />
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
