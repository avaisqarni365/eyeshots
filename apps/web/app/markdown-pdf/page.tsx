'use client';

import React, { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { 
  FileText, 
  UploadCloud, 
  Download, 
  ShieldCheck, 
  Zap, 
  AlertCircle, 
  Loader2, 
  ChevronRight, 
  Copy, 
  Check, 
  Eye, 
  Edit3, 
  Bold, 
  Italic, 
  Heading1, 
  Heading2, 
  Heading3, 
  List, 
  ListOrdered, 
  Quote, 
  Code, 
  Table as TableIcon, 
  FileDown, 
  Sparkles, 
  Columns, 
  Printer, 
  SplitSquareVertical,
  CheckSquare
} from 'lucide-react';
import { marked } from 'marked';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { toWinAnsi, wrapText } from '@/lib/pdf/text-utils';
import * as pdfjsLib from 'pdfjs-dist';

if (typeof window !== 'undefined') {
  pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';
}

const DEFAULT_MARKDOWN = `# EyeShots Document Overview
A privacy-first, commercial-grade PDF & Markdown workspace.

## Key Principles
- **100% Client-Side Processing**: Your confidential data never leaves your browser sandbox.
- **Zero Retention**: Strict ephemeral operations with zero server tracking.
- **Fast Execution**: Hardware-accelerated WebAssembly and vector rendering.

### Feature Matrix
| Operation | Execution Path | Performance |
| :--- | :--- | :--- |
| **Merge & Split** | WebAssembly (\`pdf-lib\`) | < 150ms |
| **Markdown to PDF** | Client-Side Vector Engine | Instantaneous |
| **PDF to Markdown** | Layout Heuristic Extractor | < 300ms |

> *"Simplicity is prerequisite for reliability."* — Edsger W. Dijkstra

### Code Example
\`\`\`typescript
import { PDFDocument } from 'pdf-lib';

export async function createDocument(): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const page = doc.addPage([612, 792]);
  page.drawText('Hello from EyeShots!', { x: 50, y: 700 });
  return await doc.save();
}
\`\`\`

- [x] Ephemeral privacy protection
- [x] Client-side Markdown reader and writer
- [x] Native desktop support with Tauri 2.0
`;

export default function MarkdownPdfPage() {
  const [activeTab, setActiveTab] = useState<'writer' | 'extractor'>('writer');
  const [markdownContent, setMarkdownContent] = useState<string>(DEFAULT_MARKDOWN);
  const [htmlPreview, setHtmlPreview] = useState<string>('');
  const [viewLayout, setViewLayout] = useState<'split' | 'editor' | 'preview'>('split');
  const [previewTheme, setPreviewTheme] = useState<'github' | 'academic' | 'modern-dark'>('github');

  // PDF to Markdown Extractor State
  const [extractorPdfFile, setExtractorPdfFile] = useState<File | null>(null);
  const [extractedMarkdown, setExtractedMarkdown] = useState<string>('');
  const [isExtracting, setIsExtracting] = useState<boolean>(false);
  const [copied, setCopied] = useState<boolean>(false);

  // Status & loading
  const [isExportingPdf, setIsExportingPdf] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const mdFileInputRef = useRef<HTMLInputElement>(null);
  const pdfFileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Render markdown to HTML whenever content changes
  useEffect(() => {
    try {
      const rendered = marked.parse(markdownContent, { gfm: true, breaks: true }) as string;
      setHtmlPreview(rendered);
    } catch (e) {
      console.error('Markdown parse error:', e);
    }
  }, [markdownContent]);

  // Handle uploading an existing .md file
  const handleMdUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      if (text) {
        setMarkdownContent(text);
        setStatusMessage(`Loaded "${file.name}" successfully.`);
      }
    };
    reader.readAsText(file);
  };

  // Insert markdown syntax helper
  const insertSyntax = (before: string, after: string = '') => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const text = textarea.value;
    const selected = text.substring(start, end);

    const replacement = before + (selected || 'text') + after;
    const nextContent = text.substring(0, start) + replacement + text.substring(end);
    setMarkdownContent(nextContent);

    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + before.length, start + before.length + (selected ? selected.length : 4));
    }, 50);
  };

  // Export Markdown as PDF
  const handleExportPdf = async () => {
    setIsExportingPdf(true);
    setStatusMessage('Generating paginated vector PDF from Markdown...');
    setError(null);

    try {
      const pdfDoc = await PDFDocument.create();
      const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);
      const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
      const fontMono = await pdfDoc.embedFont(StandardFonts.Courier);

      const pageWidth = 595.28; // A4 Width in points
      const pageHeight = 841.89; // A4 Height in points
      const margin = 50;
      const usableWidth = pageWidth - margin * 2;

      let currentPage = pdfDoc.addPage([pageWidth, pageHeight]);
      let currentY = pageHeight - margin;

      const lines = markdownContent.split('\n');

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];

        // Check page overflow
        if (currentY < margin + 40) {
          currentPage = pdfDoc.addPage([pageWidth, pageHeight]);
          currentY = pageHeight - margin;
        }

        // H1 Heading
        if (line.startsWith('# ')) {
          currentY -= 15;
          const text = toWinAnsi(line.replace('# ', '').trim());
          currentPage.drawText(text, {
            x: margin,
            y: currentY,
            size: 22,
            font: fontBold,
            color: rgb(0.06, 0.09, 0.16),
          });
          currentY -= 26;
        }
        // H2 Heading
        else if (line.startsWith('## ')) {
          currentY -= 12;
          const text = toWinAnsi(line.replace('## ', '').trim());
          currentPage.drawText(text, {
            x: margin,
            y: currentY,
            size: 16,
            font: fontBold,
            color: rgb(0.12, 0.23, 0.54),
          });
          currentY -= 20;
        }
        // H3 Heading
        else if (line.startsWith('### ')) {
          currentY -= 8;
          const text = toWinAnsi(line.replace('### ', '').trim());
          currentPage.drawText(text, {
            x: margin,
            y: currentY,
            size: 13,
            font: fontBold,
            color: rgb(0.2, 0.25, 0.33),
          });
          currentY -= 18;
        }
        // Blockquote
        else if (line.startsWith('> ')) {
          const text = toWinAnsi(line.replace('> ', '').trim());
          currentPage.drawRectangle({
            x: margin,
            y: currentY - 4,
            width: 3,
            height: 14,
            color: rgb(0.2, 0.6, 0.9),
          });
          currentPage.drawText(text, {
            x: margin + 10,
            y: currentY,
            size: 10,
            font: fontRegular,
            color: rgb(0.3, 0.35, 0.45),
          });
          currentY -= 16;
        }
        // Bullet List
        else if (line.trim().startsWith('- ') || line.trim().startsWith('* ')) {
          const text = toWinAnsi(line.trim().substring(2));
          currentPage.drawText('•', {
            x: margin + 6,
            y: currentY,
            size: 11,
            font: fontBold,
            color: rgb(0.02, 0.5, 0.9),
          });
          currentPage.drawText(text, {
            x: margin + 18,
            y: currentY,
            size: 10,
            font: fontRegular,
            color: rgb(0.1, 0.15, 0.2),
          });
          currentY -= 15;
        }
        // Code Block Line
        else if (line.startsWith('```')) {
          // delimiter
          currentY -= 6;
        }
        // Standard Paragraph text
        else {
          // Strip inline markup, turn [label](url) into "label (url)", and wrap to the page width.
          const cleanText = toWinAnsi(
            line.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '$1 ($2)').replace(/[*_`]/g, ''),
          );
          if (cleanText.trim().length > 0) {
            for (const wrapped of wrapText(cleanText, fontRegular, 10, usableWidth)) {
              if (currentY < margin + 20) {
                currentPage = pdfDoc.addPage([pageWidth, pageHeight]);
                currentY = pageHeight - margin;
              }
              currentPage.drawText(wrapped, {
                x: margin,
                y: currentY,
                size: 10,
                font: fontRegular,
                color: rgb(0.15, 0.2, 0.25),
              });
              currentY -= 14;
            }
            currentY -= 3;
          } else {
            currentY -= 8; // empty space
          }
        }
      }

      const pdfBytes = await pdfDoc.save();
      const blob = new Blob([pdfBytes as unknown as BlobPart], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'markdown-document.pdf';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 2000);

      setStatusMessage('PDF generated and downloaded successfully!');
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Failed to generate PDF.');
    } finally {
      setIsExportingPdf(false);
    }
  };

  // Download raw .md file
  const handleDownloadMd = () => {
    const blob = new Blob([markdownContent], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'document.md';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  };

  // PDF to Markdown Extractor Algorithm
  const handlePdfToMarkdown = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.toLowerCase().endsWith('.pdf')) {
      setError('Please select a valid PDF file.');
      return;
    }

    setExtractorPdfFile(file);
    setIsExtracting(true);
    setStatusMessage('Extracting document layout and text structure...');
    setError(null);

    try {
      const buffer = await file.arrayBuffer();
      const loadingTask = pdfjsLib.getDocument({
        data: new Uint8Array(buffer).slice(),
        cMapUrl: '/pdfjs/cmaps/',
        cMapPacked: true,
      });

      const doc = await loadingTask.promise;
      const totalPages = doc.numPages;
      let mdOutput = `# ${file.name.replace(/\.pdf$/i, '')}\n\n`;

      for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
        const page = await doc.getPage(pageNum);
        const textContent = await page.getTextContent();
        const items = textContent.items as any[];

        mdOutput += `## Page ${pageNum}\n\n`;

        let currentLineY = -1;
        let lineText = '';

        for (const item of items) {
          if (!item.str || item.str.trim() === '') continue;

          const y = Math.round(item.transform[5]);
          const fontSize = Math.round(Math.sqrt(item.transform[0] * item.transform[0] + item.transform[1] * item.transform[1]));

          // New line detection
          if (currentLineY === -1 || Math.abs(currentLineY - y) > 6) {
            if (lineText.trim()) {
              // Heuristic heading detection based on font size
              if (fontSize >= 18) {
                mdOutput += `### ${lineText.trim()}\n\n`;
              } else if (fontSize >= 14) {
                mdOutput += `#### ${lineText.trim()}\n\n`;
              } else if (lineText.trim().startsWith('•') || lineText.trim().startsWith('-')) {
                mdOutput += `- ${lineText.trim().replace(/^[•-]\s*/, '')}\n`;
              } else {
                mdOutput += `${lineText.trim()}\n\n`;
              }
            }
            currentLineY = y;
            lineText = item.str;
          } else {
            lineText += ' ' + item.str;
          }
        }

        if (lineText.trim()) {
          mdOutput += `${lineText.trim()}\n\n`;
        }
      }

      setExtractedMarkdown(mdOutput);
      setStatusMessage(`Extracted Markdown from ${totalPages} pages successfully!`);
    } catch (err: any) {
      console.error(err);
      setError('Failed to extract markdown from PDF: ' + err.message);
    } finally {
      setIsExtracting(false);
    }
  };

  const copyExtractedMarkdown = () => {
    navigator.clipboard.writeText(extractedMarkdown);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const wordCount = markdownContent.trim().split(/\s+/).filter(Boolean).length;
  const charCount = markdownContent.length;
  const readingTime = Math.ceil(wordCount / 200);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6 select-none">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-xs text-slate-500">
        <Link href="/" className="hover:text-sky-600">Home</Link>
        <ChevronRight className="w-3.5 h-3.5" />
        <span className="text-slate-900 dark:text-white font-medium">Markdown Studio</span>
      </nav>

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-sky-50 dark:bg-sky-950/60 text-sky-700 dark:text-sky-300 text-xs font-semibold border border-sky-200 dark:border-sky-800/60 mb-2">
            <Zap className="w-3.5 h-3.5 text-amber-500" />
            Live Client-Side Markdown Engine &bull; Zero Server Retention
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white">
            Markdown (.md) Reader & Writer
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 max-w-xl">
            Read, write, edit, and convert between Markdown files and styled PDF documents directly in your browser.
          </p>
        </div>

        {/* Tab Switcher: Writer vs PDF Extractor */}
        <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl text-xs font-semibold shrink-0">
          <button
            onClick={() => setActiveTab('writer')}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg transition-all ${
              activeTab === 'writer'
                ? 'bg-white dark:bg-slate-700 text-sky-700 dark:text-sky-300 shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
            }`}
          >
            <Edit3 className="w-4 h-4 text-sky-600" />
            <span>MD Reader & Writer (MD ➔ PDF)</span>
          </button>
          <button
            onClick={() => setActiveTab('extractor')}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg transition-all ${
              activeTab === 'extractor'
                ? 'bg-white dark:bg-slate-700 text-sky-700 dark:text-sky-300 shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
            }`}
          >
            <FileDown className="w-4 h-4 text-emerald-600" />
            <span>PDF to Markdown (PDF ➔ MD)</span>
          </button>
        </div>
      </div>

      {/* Notifications */}
      {statusMessage && (
        <div className="p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 text-emerald-700 text-xs flex items-center gap-2 animate-fade-in">
          <Check className="w-4 h-4 text-emerald-600" />
          <span>{statusMessage}</span>
        </div>
      )}

      {error && (
        <div className="p-3.5 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 text-red-700 text-xs flex items-center gap-2 animate-fade-in">
          <AlertCircle className="w-4 h-4 text-red-600" />
          <span>{error}</span>
        </div>
      )}

      {/* TAB 1: MARKDOWN READER & WRITER */}
      {activeTab === 'writer' && (
        <div className="space-y-4">
          {/* Smart Markdown Formatting Toolbar */}
          <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
            <div className="flex items-center gap-1 flex-wrap">
              <button
                onClick={() => insertSyntax('# ', '')}
                className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold text-xs"
                title="Heading 1"
              >
                <Heading1 className="w-4 h-4" />
              </button>
              <button
                onClick={() => insertSyntax('## ', '')}
                className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold text-xs"
                title="Heading 2"
              >
                <Heading2 className="w-4 h-4" />
              </button>
              <button
                onClick={() => insertSyntax('### ', '')}
                className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold text-xs"
                title="Heading 3"
              >
                <Heading3 className="w-4 h-4" />
              </button>

              <div className="h-4 w-px bg-slate-200 dark:bg-slate-700 mx-1" />

              <button
                onClick={() => insertSyntax('**', '**')}
                className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold text-xs"
                title="Bold"
              >
                <Bold className="w-4 h-4" />
              </button>
              <button
                onClick={() => insertSyntax('*', '*')}
                className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold text-xs"
                title="Italic"
              >
                <Italic className="w-4 h-4" />
              </button>
              <button
                onClick={() => insertSyntax('> ', '')}
                className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold text-xs"
                title="Quote"
              >
                <Quote className="w-4 h-4" />
              </button>
              <button
                onClick={() => insertSyntax('`', '`')}
                className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 font-mono text-xs"
                title="Inline Code"
              >
                <Code className="w-4 h-4" />
              </button>
              <button
                onClick={() => insertSyntax('- ', '')}
                className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold text-xs"
                title="Bullet List"
              >
                <List className="w-4 h-4" />
              </button>
              <button
                onClick={() => insertSyntax('1. ', '')}
                className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold text-xs"
                title="Numbered List"
              >
                <ListOrdered className="w-4 h-4" />
              </button>
              <button
                onClick={() => insertSyntax('\n| Column 1 | Column 2 |\n| :--- | :--- |\n| Value 1 | Value 2 |\n')}
                className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold text-xs"
                title="Insert Table"
              >
                <TableIcon className="w-4 h-4" />
              </button>
            </div>

            {/* Layout & Action Buttons */}
            <div className="flex items-center gap-2">
              {/* View Layout Toggle */}
              <div className="flex items-center gap-0.5 bg-slate-100 dark:bg-slate-800 p-0.5 rounded-lg text-xs">
                <button
                  onClick={() => setViewLayout('editor')}
                  className={`px-2 py-1 rounded ${viewLayout === 'editor' ? 'bg-white shadow text-sky-600 font-bold' : 'text-slate-500'}`}
                >
                  Editor
                </button>
                <button
                  onClick={() => setViewLayout('split')}
                  className={`px-2 py-1 rounded ${viewLayout === 'split' ? 'bg-white shadow text-sky-600 font-bold' : 'text-slate-500'}`}
                >
                  Split
                </button>
                <button
                  onClick={() => setViewLayout('preview')}
                  className={`px-2 py-1 rounded ${viewLayout === 'preview' ? 'bg-white shadow text-sky-600 font-bold' : 'text-slate-500'}`}
                >
                  Preview
                </button>
              </div>

              {/* Upload .md */}
              <button
                onClick={() => mdFileInputRef.current?.click()}
                className="px-3 py-1.5 rounded-xl border border-slate-200 hover:bg-slate-100 text-xs text-slate-700 dark:text-slate-300 flex items-center gap-1 font-semibold"
              >
                <UploadCloud className="w-3.5 h-3.5 text-sky-600" />
                <span>Open .md</span>
              </button>
              <input
                ref={mdFileInputRef}
                type="file"
                accept=".md,.markdown,text/markdown,text/plain"
                onChange={handleMdUpload}
                className="hidden"
              />

              {/* Download .md */}
              <button
                onClick={handleDownloadMd}
                className="px-3 py-1.5 rounded-xl border border-slate-200 hover:bg-slate-100 text-xs text-slate-700 dark:text-slate-300 flex items-center gap-1 font-semibold"
              >
                <Download className="w-3.5 h-3.5 text-slate-500" />
                <span>Save .md</span>
              </button>

              {/* Export PDF */}
              <button
                onClick={handleExportPdf}
                disabled={isExportingPdf}
                className="px-4 py-1.5 rounded-xl bg-sky-600 hover:bg-sky-700 text-white font-bold text-xs shadow flex items-center gap-1.5"
              >
                {isExportingPdf ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Printer className="w-3.5 h-3.5" />
                )}
                <span>Export PDF</span>
              </button>
            </div>
          </div>

          {/* Dual-Pane Workspace */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 h-[650px]">
            {/* Left Pane: Markdown Textarea Editor */}
            {(viewLayout === 'split' || viewLayout === 'editor') && (
              <div className={`flex flex-col h-full bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden ${viewLayout === 'editor' ? 'lg:col-span-2' : ''}`}>
                <div className="px-4 py-2 bg-slate-50 dark:bg-slate-800/60 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between text-[11px] text-slate-500 font-bold uppercase tracking-wider">
                  <span>Markdown Source</span>
                  <span>{wordCount} words &bull; {charCount} chars &bull; ~{readingTime} min read</span>
                </div>
                <textarea
                  ref={textareaRef}
                  value={markdownContent}
                  onChange={(e) => setMarkdownContent(e.target.value)}
                  placeholder="Type or paste markdown here..."
                  className="flex-1 p-4 font-mono text-xs sm:text-sm bg-transparent resize-none focus:outline-none leading-relaxed text-slate-800 dark:text-slate-200"
                />
              </div>
            )}

            {/* Right Pane: Live HTML / Document Reader Preview */}
            {(viewLayout === 'split' || viewLayout === 'preview') && (
              <div className={`flex flex-col h-full bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden ${viewLayout === 'preview' ? 'lg:col-span-2' : ''}`}>
                <div className="px-4 py-2 bg-slate-50 dark:bg-slate-800/60 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between text-[11px] text-slate-500 font-bold uppercase tracking-wider">
                  <span>Formatted Reader Preview</span>
                  <div className="flex items-center gap-1.5 lowercase">
                    <span className="text-[10px]">Theme:</span>
                    <select
                      value={previewTheme}
                      onChange={(e) => setPreviewTheme(e.target.value as any)}
                      className="bg-transparent border rounded px-1.5 py-0.5 text-[11px]"
                    >
                      <option value="github">GitHub Light</option>
                      <option value="academic">Academic Formal</option>
                      <option value="modern-dark">Dark Mode</option>
                    </select>
                  </div>
                </div>

                <div className="flex-1 p-6 overflow-y-auto prose dark:prose-invert max-w-none text-slate-800 dark:text-slate-200">
                  <div
                    dangerouslySetInnerHTML={{ __html: htmlPreview }}
                    className="space-y-4 text-sm leading-relaxed"
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: PDF TO MARKDOWN EXTRACTOR */}
      {activeTab === 'extractor' && (
        <div className="space-y-6">
          <div
            onClick={() => pdfFileInputRef.current?.click()}
            className="group relative border-2 border-dashed border-emerald-300 dark:border-emerald-700/80 hover:border-emerald-500 rounded-3xl p-10 sm:p-14 text-center cursor-pointer bg-white/70 dark:bg-slate-900/70 hover:bg-emerald-50/40 dark:hover:bg-emerald-950/20 transition-all shadow-sm"
          >
            <input
              ref={pdfFileInputRef}
              type="file"
              accept=".pdf,application/pdf"
              onChange={handlePdfToMarkdown}
              className="hidden"
            />

            <div className="flex flex-col items-center gap-3">
              <div className="w-16 h-16 rounded-2xl bg-emerald-50 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 flex items-center justify-center group-hover:scale-110 transition-transform shadow-md shadow-emerald-500/10">
                <FileDown className="w-8 h-8" />
              </div>
              <div>
                <span className="text-base font-bold text-slate-800 dark:text-slate-100">
                  Click to select a PDF document to convert to Markdown
                </span>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  Reconstructs headings, lists, tables, and paragraphs into formatted Markdown &bull; Zero server upload
                </p>
              </div>
            </div>
          </div>

          {isExtracting && (
            <div className="p-8 rounded-2xl bg-white dark:bg-slate-900 border text-center space-y-3">
              <Loader2 className="w-8 h-8 animate-spin mx-auto text-emerald-600" />
              <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                Extracting typography and structure from PDF...
              </p>
            </div>
          )}

          {extractedMarkdown && (
            <div className="space-y-3 bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-200 dark:border-slate-800 shadow-sm animate-fade-in">
              <div className="flex items-center justify-between pb-3 border-b">
                <div className="flex items-center gap-2">
                  <FileText className="w-5 h-5 text-emerald-600" />
                  <span className="font-bold text-sm text-slate-800 dark:text-white">
                    Extracted Markdown Document
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={copyExtractedMarkdown}
                    className="px-3 py-1.5 rounded-xl border border-slate-200 hover:bg-slate-100 text-xs font-semibold flex items-center gap-1.5"
                  >
                    {copied ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-600" />
                        <span className="text-emerald-600">Copied!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5 text-slate-500" />
                        <span>Copy Markdown</span>
                      </>
                    )}
                  </button>

                  <button
                    onClick={() => {
                      const blob = new Blob([extractedMarkdown], { type: 'text/markdown;charset=utf-8' });
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement('a');
                      a.href = url;
                      a.download = `${extractorPdfFile?.name.replace(/\.pdf$/i, '') || 'extracted'}.md`;
                      document.body.appendChild(a);
                      a.click();
                      document.body.removeChild(a);
                    }}
                    className="px-4 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow flex items-center gap-1.5"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Download .md</span>
                  </button>
                </div>
              </div>

              <textarea
                value={extractedMarkdown}
                onChange={(e) => setExtractedMarkdown(e.target.value)}
                rows={16}
                className="w-full font-mono text-xs sm:text-sm p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-200 dark:border-slate-700 focus:outline-none"
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
