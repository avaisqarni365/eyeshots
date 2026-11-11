/**
 * EyeShots tool registry — the single source of truth for every tool.
 *
 * Drives: navbar mega-menu, command palette (Ctrl/Cmd+K), home grid, footer,
 * sitemap.xml, per-route SEO metadata, and "related tools" sections.
 * Add a tool here once and it appears everywhere.
 */

export type ToolProcessing = 'client' | 'server' | 'hybrid';

export type ToolCategoryId =
  | 'organize'
  | 'edit'
  | 'convert-to'
  | 'convert-from'
  | 'optimize'
  | 'security'
  | 'business';

export interface ToolCategory {
  id: ToolCategoryId;
  label: string;
  description: string;
}

export interface PdfTool {
  id: string;
  name: string;
  /** Short label used in dense menus. */
  shortName?: string;
  slug: string;
  path: string;
  category: ToolCategoryId;
  processing: ToolProcessing;
  description: string;
  /** Long-form SEO description (meta description). */
  seoDescription: string;
  /** Extra search terms for the command palette. */
  keywords: string[];
  /** lucide-react icon name, resolved by <ToolIcon />. */
  iconName: string;
  /** Tailwind color family used for the tool's icon tile. */
  color: 'emerald' | 'blue' | 'violet' | 'amber' | 'rose' | 'sky' | 'slate' | 'teal' | 'orange';
  popular?: boolean;
  isNew?: boolean;
  /** Plan required to use the tool. Free tools respect free-tier limits. */
  plan?: 'free' | 'pro';
}

export const TOOL_CATEGORIES: ToolCategory[] = [
  { id: 'organize', label: 'Organize', description: 'Merge, split, reorder and trim pages' },
  { id: 'edit', label: 'Edit & Sign', description: 'Edit content, annotate, fill and sign' },
  { id: 'convert-to', label: 'Convert to PDF', description: 'Turn images and Office files into PDF' },
  { id: 'convert-from', label: 'Convert from PDF', description: 'Export PDF to Word, images and text' },
  { id: 'optimize', label: 'Optimize', description: 'Compress, repair and enhance documents' },
  { id: 'security', label: 'Security', description: 'Encrypt, unlock and protect' },
  { id: 'business', label: 'Business & AI', description: 'Invoices, comparison, translation, DMS' },
];

export const PDF_TOOLS: PdfTool[] = [
  // ── Organize ────────────────────────────────────────────────
  {
    id: 'merge-pdf', name: 'Merge PDF', shortName: 'Merge', slug: 'merge-pdf', path: '/merge-pdf',
    category: 'organize', processing: 'client', iconName: 'Combine', color: 'blue', popular: true,
    description: 'Combine multiple PDFs into one document and reorder them visually.',
    seoDescription: 'Merge PDF files online for free. Combine multiple PDFs into one document in seconds — processed entirely in your browser, nothing is uploaded.',
    keywords: ['combine', 'join', 'append', 'concatenate'],
  },
  {
    id: 'split-pdf', name: 'Split PDF', shortName: 'Split', slug: 'split-pdf', path: '/split-pdf',
    category: 'organize', processing: 'client', iconName: 'Split', color: 'amber', popular: true,
    description: 'Split by page ranges, every N pages, or extract each page to its own file.',
    seoDescription: 'Split PDF files online. Extract page ranges, split every N pages or into single pages — free, private and instant in your browser.',
    keywords: ['extract', 'separate', 'divide', 'ranges', 'pages'],
  },
  {
    id: 'delete-pages', name: 'Delete Pages', slug: 'delete-pages', path: '/delete-pages',
    category: 'organize', processing: 'client', iconName: 'Trash2', color: 'rose', popular: true,
    description: 'Visually select and remove unwanted pages from any PDF.',
    seoDescription: 'Delete pages from a PDF online. Select pages visually and remove them instantly — no upload, no sign-up.',
    keywords: ['remove', 'pages', 'erase'],
  },
  {
    id: 'rotate-pdf', name: 'Rotate & Organize', shortName: 'Rotate', slug: 'rotate-pdf', path: '/rotate-pdf',
    category: 'organize', processing: 'client', iconName: 'RotateCw', color: 'sky',
    description: 'Rotate single pages or the whole document permanently, without quality loss.',
    seoDescription: 'Rotate PDF pages online. Turn individual pages or the entire document 90°, 180° or 270° and save permanently.',
    keywords: ['turn', 'orientation', 'landscape', 'portrait', 'organize', 'reorder'],
  },
  {
    id: 'crop-pdf', name: 'Crop PDF', shortName: 'Crop', slug: 'crop-pdf', path: '/crop-pdf',
    category: 'organize', processing: 'client', iconName: 'Crop', color: 'teal', isNew: true,
    description: 'Trim margins and adjust the visible page area of every page.',
    seoDescription: 'Crop PDF pages online. Trim white margins or cut pages to a custom area — free and processed locally in your browser.',
    keywords: ['trim', 'margins', 'cut', 'resize'],
  },

  // ── Edit & Sign ─────────────────────────────────────────────
  {
    id: 'edit-pdf', name: 'PDF Editor', shortName: 'Edit', slug: 'edit-pdf', path: '/edit-pdf',
    category: 'edit', processing: 'client', iconName: 'FilePenLine', color: 'emerald', popular: true,
    description: 'Edit text in place, add images, shapes, links, highlights and annotations.',
    seoDescription: 'Free online PDF editor. Edit existing PDF text, add images, shapes, signatures and annotations directly in your browser.',
    keywords: ['text', 'annotate', 'whiteout', 'highlight', 'image', 'shapes'],
  },
  {
    id: 'fill-and-sign', name: 'Fill & Sign', slug: 'fill-and-sign', path: '/fill-and-sign',
    category: 'edit', processing: 'client', iconName: 'PenTool', color: 'teal', popular: true,
    description: 'Fill out forms, tick checkboxes and add a drawn or typed signature.',
    seoDescription: 'Fill and sign PDF forms online. Type into fields, check boxes and add your signature — private and free.',
    keywords: ['signature', 'esign', 'form', 'sign'],
  },
  {
    id: 'watermark-pdf', name: 'Watermark', slug: 'watermark-pdf', path: '/watermark-pdf',
    category: 'edit', processing: 'client', iconName: 'Stamp', color: 'violet',
    description: 'Stamp text such as CONFIDENTIAL or a copyright notice on every page.',
    seoDescription: 'Add a watermark to PDF online. Stamp custom text with adjustable opacity, size and rotation on every page.',
    keywords: ['stamp', 'confidential', 'draft', 'copyright'],
  },
  {
    id: 'add-page-numbers', name: 'Page Numbers', slug: 'add-page-numbers', path: '/add-page-numbers',
    category: 'edit', processing: 'client', iconName: 'Hash', color: 'slate',
    description: 'Add page numbers with custom position and starting number.',
    seoDescription: 'Add page numbers to PDF online. Choose position and starting number — fast, free and private.',
    keywords: ['numbering', 'bates', 'footer', 'pagination'],
  },
  {
    id: 'forms', name: 'Forms Hub', slug: 'forms', path: '/forms',
    category: 'edit', processing: 'client', iconName: 'FileCheck2', color: 'amber',
    description: 'Official forms by category — social, tax, legal and civic — with smart auto-fill.',
    seoDescription: 'Find and fill official PDF forms by category with smart auto-fill, directly in your browser.',
    keywords: ['official', 'government', 'tax', 'jobcenter', 'german', 'antrag'],
  },
  {
    id: 'markdown-pdf', name: 'Markdown Studio', slug: 'markdown-pdf', path: '/markdown-pdf',
    category: 'edit', processing: 'client', iconName: 'FileCode2', color: 'slate',
    description: 'Write Markdown with live preview and convert to and from PDF.',
    seoDescription: 'Convert Markdown to PDF and PDF to Markdown online with a live preview editor.',
    keywords: ['md', 'markdown', 'readme', 'notes'],
  },

  // ── Convert to PDF ──────────────────────────────────────────
  {
    id: 'jpg-to-pdf', name: 'Images to PDF', shortName: 'JPG to PDF', slug: 'jpg-to-pdf', path: '/jpg-to-pdf',
    category: 'convert-to', processing: 'client', iconName: 'ImagePlus', color: 'orange', isNew: true, popular: true,
    description: 'Convert JPG, PNG and WebP images into a single PDF with page size options.',
    seoDescription: 'Convert JPG, PNG and WebP images to PDF online. Choose page size, orientation and margins — processed in your browser.',
    keywords: ['jpg', 'jpeg', 'png', 'webp', 'image', 'photo', 'scan'],
  },
  {
    id: 'word-to-pdf', name: 'Word to PDF', slug: 'word-to-pdf', path: '/word-to-pdf',
    category: 'convert-to', processing: 'server', iconName: 'FileType2', color: 'blue',
    description: 'Convert DOCX, DOC and ODT documents into high-fidelity PDFs.',
    seoDescription: 'Convert Word to PDF online. DOCX, DOC and ODT to PDF with accurate layout. Files are deleted automatically within 2 hours.',
    keywords: ['docx', 'doc', 'odt', 'office', 'word'],
  },
  {
    id: 'excel-to-pdf', name: 'Excel to PDF', slug: 'excel-to-pdf', path: '/excel-to-pdf',
    category: 'convert-to', processing: 'server', iconName: 'Sheet', color: 'emerald',
    description: 'Convert XLSX, XLS and ODS spreadsheets into clean PDF printouts.',
    seoDescription: 'Convert Excel to PDF online. XLSX, XLS and ODS spreadsheets to PDF. Files are deleted automatically within 2 hours.',
    keywords: ['xlsx', 'xls', 'ods', 'spreadsheet', 'excel'],
  },
  {
    id: 'powerpoint-to-pdf', name: 'PowerPoint to PDF', shortName: 'PPT to PDF', slug: 'powerpoint-to-pdf', path: '/powerpoint-to-pdf',
    category: 'convert-to', processing: 'server', iconName: 'Presentation', color: 'orange',
    description: 'Convert PPTX, PPT and ODP decks into PDF slides.',
    seoDescription: 'Convert PowerPoint to PDF online. PPTX, PPT and ODP presentations to PDF. Files are deleted automatically within 2 hours.',
    keywords: ['pptx', 'ppt', 'odp', 'slides', 'presentation'],
  },

  // ── Convert from PDF ────────────────────────────────────────
  {
    id: 'pdf-to-word', name: 'PDF to Word', slug: 'pdf-to-word', path: '/pdf-to-word',
    category: 'convert-from', processing: 'server', iconName: 'FileText', color: 'blue', popular: true,
    description: 'Turn PDFs into editable Microsoft Word (.docx) documents.',
    seoDescription: 'Convert PDF to Word online. Turn PDF into editable DOCX. Files are deleted automatically within 2 hours.',
    keywords: ['docx', 'doc', 'word', 'editable'],
  },
  {
    id: 'pdf-to-jpg', name: 'PDF to Images', shortName: 'PDF to JPG', slug: 'pdf-to-jpg', path: '/pdf-to-jpg',
    category: 'convert-from', processing: 'client', iconName: 'Images', color: 'orange', isNew: true,
    description: 'Export every page as a high-resolution JPG or PNG, downloaded as a ZIP.',
    seoDescription: 'Convert PDF to JPG or PNG online. Export each page as a high-resolution image — processed locally in your browser.',
    keywords: ['jpg', 'png', 'image', 'export', 'picture', 'render'],
  },
  {
    id: 'ocr-pdf', name: 'OCR PDF', slug: 'ocr-pdf', path: '/ocr-pdf',
    category: 'convert-from', processing: 'server', iconName: 'ScanText', color: 'violet', popular: true,
    description: 'Make scanned PDFs searchable and selectable with Tesseract OCR.',
    seoDescription: 'OCR PDF online. Convert scanned PDFs into searchable, selectable text in 100+ languages.',
    keywords: ['ocr', 'scan', 'searchable', 'text recognition', 'tesseract'],
  },

  // ── Optimize ────────────────────────────────────────────────
  {
    id: 'compress-pdf', name: 'Compress PDF', shortName: 'Compress', slug: 'compress-pdf', path: '/compress-pdf',
    category: 'optimize', processing: 'server', iconName: 'FileArchive', color: 'violet', popular: true,
    description: 'Shrink file size while keeping text crisp and images readable.',
    seoDescription: 'Compress PDF online. Reduce PDF file size while preserving quality. Files are deleted automatically within 2 hours.',
    keywords: ['reduce', 'shrink', 'smaller', 'optimize', 'size'],
  },
  {
    id: 'repair-pdf', name: 'Repair PDF', shortName: 'Repair', slug: 'repair-pdf', path: '/repair-pdf',
    category: 'optimize', processing: 'hybrid', iconName: 'Wrench', color: 'slate',
    description: 'Recover damaged or corrupted PDFs by rebuilding their structure.',
    seoDescription: 'Repair corrupted PDF files online. Rebuild damaged cross-reference tables and recover pages.',
    keywords: ['fix', 'recover', 'corrupt', 'broken', 'damaged'],
  },
  {
    id: 'enhance-pdf', name: 'Enhance Scans', slug: 'enhance-pdf', path: '/enhance-pdf',
    category: 'optimize', processing: 'client', iconName: 'Sparkles', color: 'amber',
    description: 'Improve contrast and readability of faint scans, photos and receipts.',
    seoDescription: 'Enhance scanned PDFs online. Improve contrast and readability of faint scans and receipts in your browser.',
    keywords: ['contrast', 'brighten', 'scan', 'readability', 'receipt'],
  },

  // ── Security ────────────────────────────────────────────────
  {
    id: 'protect-pdf', name: 'Protect PDF', shortName: 'Protect', slug: 'protect-pdf', path: '/protect-pdf',
    category: 'security', processing: 'server', iconName: 'Lock', color: 'slate',
    description: 'Encrypt a PDF with a password using AES-256.',
    seoDescription: 'Password protect PDF online with AES-256 encryption. Files are deleted automatically within 2 hours.',
    keywords: ['password', 'encrypt', 'secure', 'aes'],
  },
  {
    id: 'unlock-pdf', name: 'Unlock PDF', shortName: 'Unlock', slug: 'unlock-pdf', path: '/unlock-pdf',
    category: 'security', processing: 'server', iconName: 'LockOpen', color: 'slate',
    description: 'Remove a known password and usage restrictions from a PDF.',
    seoDescription: 'Unlock PDF online. Remove the password from a PDF you have the password for.',
    keywords: ['decrypt', 'remove password', 'unprotect'],
  },

  // ── Business & AI ───────────────────────────────────────────
  {
    id: 'compare-pdf', name: 'Compare PDF', slug: 'compare-pdf', path: '/compare-pdf',
    category: 'business', processing: 'client', iconName: 'GitCompareArrows', color: 'violet', popular: true,
    description: 'Compare two PDFs side by side with synced scrolling and word-level diff.',
    seoDescription: 'Compare two PDF files online. Side-by-side view, swipe overlay and word-by-word differences — processed in your browser.',
    keywords: ['diff', 'difference', 'changes', 'redline', 'versions'],
  },
  {
    id: 'scan-invoice', name: 'Invoice Scanner', slug: 'scan-invoice', path: '/scan-invoice',
    category: 'business', processing: 'hybrid', iconName: 'Receipt', color: 'blue',
    description: 'Extract totals, IBAN and VAT from invoices; export DATEV CSV and ZUGFeRD XML.',
    seoDescription: 'Scan invoices to structured data. Extract totals, IBAN and VAT and export to DATEV CSV or ZUGFeRD XML.',
    keywords: ['invoice', 'receipt', 'datev', 'zugferd', 'xrechnung', 'accounting'],
  },
  {
    id: 'pdf-space', name: 'Translate PDF', slug: 'pdf-space', path: '/pdf-space',
    category: 'business', processing: 'hybrid', iconName: 'Languages', color: 'emerald',
    description: 'Read and translate PDFs side by side with synced scrolling and bilingual export.',
    seoDescription: 'Translate PDF documents side by side with synchronized scrolling and bilingual PDF export.',
    keywords: ['translate', 'translation', 'bilingual', 'language', 'reader'],
  },
  {
    id: 'pdf-viewer', name: 'PDF Viewer', slug: 'pdf-viewer', path: '/pdf-viewer',
    category: 'business', processing: 'client', iconName: 'BookOpen', color: 'sky',
    description: 'Open and read PDFs instantly with zoom, search and page navigation.',
    seoDescription: 'Free online PDF viewer. Open and read PDF files instantly in your browser — nothing is uploaded.',
    keywords: ['view', 'read', 'open', 'reader'],
  },
  {
    id: 'dms', name: 'Document Workspace', shortName: 'DMS', slug: 'dms', path: '/dms',
    category: 'business', processing: 'client', iconName: 'FolderKanban', color: 'teal',
    description: 'Organize documents into projects and work on them in a single studio.',
    seoDescription: 'Organize PDF documents into projects with a browser-based document workspace.',
    keywords: ['dms', 'projects', 'folders', 'organize', 'studio', 'workspace'],
    plan: 'pro',
  },
];

export const TOOLS_BY_ID: Record<string, PdfTool> = Object.fromEntries(PDF_TOOLS.map((t) => [t.id, t]));

export function getTool(id: string): PdfTool | undefined {
  return TOOLS_BY_ID[id];
}

export function toolsInCategory(category: ToolCategoryId): PdfTool[] {
  return PDF_TOOLS.filter((t) => t.category === category);
}

export const POPULAR_TOOLS = PDF_TOOLS.filter((t) => t.popular);

/** Related tools: same category first, then popular tools, excluding the current one. */
export function relatedTools(id: string, limit = 4): PdfTool[] {
  const tool = TOOLS_BY_ID[id];
  if (!tool) return POPULAR_TOOLS.slice(0, limit);
  const sameCat = PDF_TOOLS.filter((t) => t.category === tool.category && t.id !== id);
  const rest = POPULAR_TOOLS.filter((t) => t.id !== id && !sameCat.includes(t));
  return [...sameCat, ...rest].slice(0, limit);
}

export function searchTools(query: string): PdfTool[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const scored = PDF_TOOLS.map((t) => {
    const name = t.name.toLowerCase();
    let score = 0;
    if (name.startsWith(q)) score += 10;
    else if (name.includes(q)) score += 6;
    if (t.keywords.some((k) => k.startsWith(q))) score += 4;
    if (t.description.toLowerCase().includes(q)) score += 1;
    return { t, score };
  }).filter((x) => x.score > 0);
  return scored.sort((a, b) => b.score - a.score).map((x) => x.t);
}

export const PROCESSING_LABEL: Record<ToolProcessing, string> = {
  client: 'Runs in your browser',
  server: 'Secure cloud engine',
  hybrid: 'Browser + cloud',
};
