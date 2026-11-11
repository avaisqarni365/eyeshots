import * as pdfjsLib from 'pdfjs-dist';

if (typeof window !== 'undefined') {
  pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';
}

interface TextSpan {
  str: string;
  x: number;
  y: number;
  width: number;
  height: number;
  fontSize: number;
  fontName: string;
}

interface LineItem {
  y: number;
  fontSize: number;
  isBold: boolean;
  isItalic: boolean;
  text: string;
  items: TextSpan[];
}

/**
 * Converts any PDF ArrayBuffer or File into a complete, structured GitHub Markdown (.md) document.
 * Analyzes font sizes, baselines, list markers, and tabular columns.
 */
export async function convertPdfToMarkdown(
  fileOrBuffer: File | ArrayBuffer,
  onProgress?: (currentPage: number, totalPages: number) => void
): Promise<{ markdown: string; pageCount: number; wordCount: number }> {
  let arrayBuffer: ArrayBuffer;
  if (fileOrBuffer instanceof File) {
    arrayBuffer = await fileOrBuffer.arrayBuffer();
  } else {
    arrayBuffer = fileOrBuffer;
  }

  const loadingTask = pdfjsLib.getDocument({
    data: new Uint8Array(arrayBuffer).slice(),
    cMapUrl: '/pdfjs/cmaps/',
    cMapPacked: true,
  });

  const doc = await loadingTask.promise;
  const totalPages = doc.numPages;
  let fullMarkdown = '';
  let totalWords = 0;

  // Global pass to compute median body font size
  const fontSizes: number[] = [];

  for (let pageNum = 1; pageNum <= Math.min(totalPages, 5); pageNum++) {
    const page = await doc.getPage(pageNum);
    const content = await page.getTextContent();
    for (const item of content.items as any[]) {
      if (item.str && item.str.trim().length > 0) {
        const sz = Math.round(Math.sqrt(item.transform[0] * item.transform[0] + item.transform[1] * item.transform[1]));
        if (sz > 0) fontSizes.push(sz);
      }
    }
  }

  fontSizes.sort((a, b) => a - b);
  const medianFontSize = fontSizes.length > 0 ? fontSizes[Math.floor(fontSizes.length / 2)] : 12;

  // Process each page
  for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
    if (onProgress) onProgress(pageNum, totalPages);
    const page = await doc.getPage(pageNum);
    const content = await page.getTextContent();
    const items = content.items as any[];

    if (items.length === 0) {
      fullMarkdown += `\n\n---\n*Page ${pageNum} (Scanned Image - Run OCR to extract text)*\n\n`;
      continue;
    }

    // Collect spans
    const spans: TextSpan[] = [];
    for (const item of items) {
      if (!item.str || item.str.trim() === '') continue;

      const x = Math.round(item.transform[4]);
      const y = Math.round(item.transform[5]);
      const fontSize = Math.round(Math.sqrt(item.transform[0] * item.transform[0] + item.transform[1] * item.transform[1]));
      const fontName = item.fontName || '';

      spans.push({
        str: item.str,
        x,
        y,
        width: Math.round(item.width || 0),
        height: Math.round(item.height || fontSize),
        fontSize,
        fontName,
      });
    }

    // Sort spans top-to-bottom (PDF y is inverted: higher y is higher on the page), then left-to-right
    spans.sort((a, b) => {
      const yDiff = b.y - a.y;
      if (Math.abs(yDiff) > 5) {
        return yDiff;
      }
      return a.x - b.x;
    });

    // Group spans into distinct lines
    const lines: LineItem[] = [];
    let currentLine: LineItem | null = null;

    for (const span of spans) {
      const isBold = /bold|black|heavy/i.test(span.fontName);
      const isItalic = /italic|oblique/i.test(span.fontName);

      if (!currentLine || Math.abs(currentLine.y - span.y) > 4) {
        if (currentLine) {
          lines.push(currentLine);
        }
        currentLine = {
          y: span.y,
          fontSize: span.fontSize,
          isBold,
          isItalic,
          text: span.str,
          items: [span],
        };
      } else {
        // Same line: add space if there's a horizontal gap
        const lastSpan = currentLine.items[currentLine.items.length - 1];
        const gap = span.x - (lastSpan.x + lastSpan.width);
        if (gap > 3) {
          currentLine.text += ' ' + span.str;
        } else {
          currentLine.text += span.str;
        }
        currentLine.items.push(span);
        currentLine.fontSize = Math.max(currentLine.fontSize, span.fontSize);
        if (isBold) currentLine.isBold = true;
      }
    }
    if (currentLine) {
      lines.push(currentLine);
    }

    // Reconstruct page markdown
    let pageMd = `\n\n---\n*Page ${pageNum}*\n\n`;

    let inTable = false;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmed = line.text.trim();
      if (!trimmed) continue;

      totalWords += trimmed.split(/\s+/).length;

      // 1. Detect Tables: multiple items with wide spacing (> 40px)
      if (line.items.length >= 3 && line.items.some((it, idx) => idx > 0 && it.x - line.items[idx - 1].x > 50)) {
        const cols = line.items.map((it) => it.str.trim()).filter(Boolean);
        if (!inTable) {
          pageMd += `| ${cols.join(' | ')} |\n`;
          pageMd += `| ${cols.map(() => '---').join(' | ')} |\n`;
          inTable = true;
        } else {
          pageMd += `| ${cols.join(' | ')} |\n`;
        }
        continue;
      } else {
        inTable = false;
      }

      // 2. Heading 1 (e.g. Document Title): font size >= median * 1.5
      if (line.fontSize >= medianFontSize * 1.5) {
        pageMd += `# ${trimmed}\n\n`;
      }
      // 3. Heading 2 (e.g. Section Header): font size >= median * 1.25
      else if (line.fontSize >= medianFontSize * 1.25) {
        pageMd += `## ${trimmed}\n\n`;
      }
      // 4. Heading 3: font size >= median * 1.1 or bold line
      else if (line.fontSize >= medianFontSize * 1.1 || (line.isBold && trimmed.length < 60 && !trimmed.endsWith('.'))) {
        pageMd += `### ${trimmed}\n\n`;
      }
      // 5. Bullet Lists: starts with •, -, *, etc.
      else if (/^[•\-*○■▸✓]\s*/.test(trimmed)) {
        const clean = trimmed.replace(/^[•\-*○■▸✓]\s*/, '');
        pageMd += `- ${clean}\n`;
      }
      // 6. Numbered Lists: starts with 1., 2., 1), etc.
      else if (/^\d+[\.\)]\s+/.test(trimmed)) {
        pageMd += `${trimmed}\n`;
      }
      // 7. Checkboxes: [ ] or [x]
      else if (/^\[([ xX])\]\s+/.test(trimmed)) {
        pageMd += `- ${trimmed}\n`;
      }
      // 8. Standard paragraph
      else {
        // If italic
        if (line.isItalic && !trimmed.startsWith('*')) {
          pageMd += `*${trimmed}*\n\n`;
        } else {
          pageMd += `${trimmed}\n\n`;
        }
      }
    }

    fullMarkdown += pageMd;
  }

  return {
    markdown: fullMarkdown.trim(),
    pageCount: totalPages,
    wordCount: totalWords,
  };
}
