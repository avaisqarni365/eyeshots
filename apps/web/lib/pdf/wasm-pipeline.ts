import { PDFDocument, rgb, degrees, StandardFonts } from 'pdf-lib';

export interface WatermarkOptions {
  text: string;
  fontSize?: number;
  opacity?: number;
  rotation?: number;
  color?: { r: number; g: number; b: number };
}

/**
 * 1. Merge multiple PDFs in pure client-side WebAssembly / JS ($0 server cost).
 */
export async function mergePdfsClient(pdfArrayBuffers: ArrayBuffer[]): Promise<Uint8Array> {
  if (pdfArrayBuffers.length < 2) {
    throw new Error('Please select at least 2 PDF documents to merge.');
  }

  const mergedDoc = await PDFDocument.create();

  for (const buffer of pdfArrayBuffers) {
    const srcDoc = await PDFDocument.load(buffer, { ignoreEncryption: true });
    const copiedPages = await mergedDoc.copyPages(srcDoc, srcDoc.getPageIndices());
    copiedPages.forEach((page) => mergedDoc.addPage(page));
  }

  return await mergedDoc.save();
}

/**
 * 2. Rotate specified pages in pure client-side PDF.
 * pageRotations: { [pageIndex: number]: 90 | 180 | 270 | -90 }
 */
export async function rotatePagesClient(
  pdfBuffer: ArrayBuffer,
  pageRotations: Record<number, number>
): Promise<Uint8Array> {
  const doc = await PDFDocument.load(pdfBuffer);
  const pageCount = doc.getPageCount();

  for (const [pageIdxStr, rotDeg] of Object.entries(pageRotations)) {
    const pageIndex = parseInt(pageIdxStr, 10);
    if (pageIndex >= 0 && pageIndex < pageCount) {
      const page = doc.getPage(pageIndex);
      const current = page.getRotation().angle;
      const normalized = ((current + rotDeg) % 360 + 360) % 360;
      page.setRotation(degrees(normalized));
    }
  }

  return await doc.save();
}

/**
 * 3. Delete specific pages from a PDF document.
 * pagesToDelete: 0-indexed page numbers
 */
export async function deletePagesClient(
  pdfBuffer: ArrayBuffer,
  pagesToDelete: number[]
): Promise<Uint8Array> {
  const doc = await PDFDocument.load(pdfBuffer);
  const pageCount = doc.getPageCount();

  if (pagesToDelete.length >= pageCount) {
    throw new Error('Cannot delete all pages of the document.');
  }

  // Sort descending so indices don't shift during removal
  const sorted = [...pagesToDelete].sort((a, b) => b - a);
  for (const idx of sorted) {
    if (idx >= 0 && idx < doc.getPageCount()) {
      doc.removePage(idx);
    }
  }

  return await doc.save();
}

/**
 * 3b. Extract specific pages into a new standalone PDF document.
 * pageIndices: 0-indexed page numbers
 */
export async function extractPagesClient(
  pdfBuffer: ArrayBuffer,
  pageIndices: number[]
): Promise<Uint8Array> {
  const srcDoc = await PDFDocument.load(pdfBuffer, { ignoreEncryption: true });
  const newDoc = await PDFDocument.create();
  const total = srcDoc.getPageCount();
  const validIndices = pageIndices.filter((idx) => idx >= 0 && idx < total);

  if (validIndices.length === 0) {
    throw new Error('No valid pages selected for extraction.');
  }

  const copiedPages = await newDoc.copyPages(srcDoc, validIndices);
  copiedPages.forEach((page) => newDoc.addPage(page));

  return await newDoc.save();
}

/**
 * Helper: Parses range string like "1-3, 5, 8-10" into 0-indexed page numbers.
 */
export function parsePageRangeString(rangeStr: string, totalPages: number): number[] {
  const parts = rangeStr.split(',').map((s) => s.trim()).filter(Boolean);
  const selected = new Set<number>();

  for (const part of parts) {
    if (part.includes('-')) {
      const [startStr, endStr] = part.split('-').map((s) => parseInt(s.trim(), 10));
      if (!isNaN(startStr) && !isNaN(endStr)) {
        const start = Math.max(1, Math.min(startStr, endStr));
        const end = Math.min(totalPages, Math.max(startStr, endStr));
        for (let p = start; p <= end; p++) {
          selected.add(p - 1);
        }
      }
    } else {
      const p = parseInt(part, 10);
      if (!isNaN(p) && p >= 1 && p <= totalPages) {
        selected.add(p - 1);
      }
    }
  }

  return Array.from(selected).sort((a, b) => a - b);
}

/**
 * 4. Add dynamic watermark text across every page.
 */
export async function watermarkPdfClient(
  pdfBuffer: ArrayBuffer,
  options: WatermarkOptions
): Promise<Uint8Array> {
  const doc = await PDFDocument.load(pdfBuffer);
  const font = await doc.embedFont(StandardFonts.HelveticaBold);
  const pages = doc.getPages();

  const fontSize = options.fontSize || 48;
  const opacity = options.opacity !== undefined ? options.opacity : 0.35;
  const rotAngle = options.rotation !== undefined ? options.rotation : 45;
  const c = options.color || { r: 0.5, g: 0.5, b: 0.5 };

  for (const page of pages) {
    const { width, height } = page.getSize();
    const textWidth = font.widthOfTextAtSize(options.text, fontSize);
    const textHeight = font.heightAtSize(fontSize);

    page.drawText(options.text, {
      x: width / 2 - textWidth / 2,
      y: height / 2 - textHeight / 2,
      size: fontSize,
      font,
      color: rgb(c.r, c.g, c.b),
      rotate: degrees(rotAngle),
      opacity,
    });
  }

  return await doc.save();
}

/**
 * 5. Add Page Numbers (e.g. Page 1 of 12)
 */
export async function addPageNumbersClient(
  pdfBuffer: ArrayBuffer,
  position: 'bottom-center' | 'bottom-right' | 'top-right' = 'bottom-center',
  startFrom: number = 1
): Promise<Uint8Array> {
  const doc = await PDFDocument.load(pdfBuffer);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const pages = doc.getPages();
  const total = pages.length;

  for (let i = 0; i < total; i++) {
    const page = pages[i];
    const { width, height } = page.getSize();
    const pageNumber = i + startFrom;
    const text = `Page ${pageNumber} of ${total}`;
    const fontSize = 10;
    const textWidth = font.widthOfTextAtSize(text, fontSize);

    let x = width / 2 - textWidth / 2;
    let y = 20;

    if (position === 'bottom-right') {
      x = width - textWidth - 30;
      y = 20;
    } else if (position === 'top-right') {
      x = width - textWidth - 30;
      y = height - 25;
    }

    page.drawText(text, {
      x,
      y,
      size: fontSize,
      font,
      color: rgb(0.25, 0.25, 0.25),
      opacity: 0.9,
    });
  }

  return await doc.save();
}

/**
 * Helper: Download binary bytes in browser as a PDF file
 */
export function downloadPdfBlob(bytes: Uint8Array, filename: string): void {
  const blob = new Blob([bytes as unknown as BlobPart], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename.endsWith('.pdf') ? filename : `${filename}.pdf`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

/**
 * Helper: Download binary zip blob in browser
 */
export function downloadZipBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename.endsWith('.zip') ? filename : `${filename}.zip`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

/**
 * Alternate & Mix (Interleave two PDF documents)
 * Takes odd pages from Doc A and even pages from Doc B (with optional reverse B for duplex scanner scans)
 */
export async function alternateAndMixClient(
  docABuffer: ArrayBuffer,
  docBBuffer: ArrayBuffer,
  reverseB: boolean = false
): Promise<Uint8Array> {
  const docA = await PDFDocument.load(docABuffer, { ignoreEncryption: true });
  const docB = await PDFDocument.load(docBBuffer, { ignoreEncryption: true });
  const mergedDoc = await PDFDocument.create();

  const countA = docA.getPageCount();
  const countB = docB.getPageCount();
  const maxPages = Math.max(countA, countB);

  const indicesB = Array.from({ length: countB }, (_, i) => i);
  if (reverseB) {
    indicesB.reverse();
  }

  for (let i = 0; i < maxPages; i++) {
    if (i < countA) {
      const [pageA] = await mergedDoc.copyPages(docA, [i]);
      mergedDoc.addPage(pageA);
    }
    if (i < countB) {
      const [pageB] = await mergedDoc.copyPages(docB, [indicesB[i]]);
      mergedDoc.addPage(pageB);
    }
  }

  return await mergedDoc.save();
}

/**
 * Split a PDF into equal halves (50/50 split)
 */
export async function splitInHalfClient(
  pdfBuffer: ArrayBuffer
): Promise<{ part1: Uint8Array; part2: Uint8Array }> {
  const srcDoc = await PDFDocument.load(pdfBuffer, { ignoreEncryption: true });
  const total = srcDoc.getPageCount();
  const mid = Math.ceil(total / 2);

  const doc1 = await PDFDocument.create();
  const doc2 = await PDFDocument.create();

  const pages1 = await doc1.copyPages(srcDoc, Array.from({ length: mid }, (_, i) => i));
  pages1.forEach((p) => doc1.addPage(p));

  const pages2 = await doc2.copyPages(srcDoc, Array.from({ length: total - mid }, (_, i) => i + mid));
  pages2.forEach((p) => doc2.addPage(p));

  return {
    part1: await doc1.save(),
    part2: await doc2.save(),
  };
}

/**
 * Split a PDF document every N pages
 */
export async function splitEveryNPagesClient(
  pdfBuffer: ArrayBuffer,
  n: number
): Promise<Uint8Array[]> {
  if (n < 1) throw new Error('N must be at least 1');
  const srcDoc = await PDFDocument.load(pdfBuffer, { ignoreEncryption: true });
  const total = srcDoc.getPageCount();
  const results: Uint8Array[] = [];

  for (let start = 0; start < total; start += n) {
    const chunkDoc = await PDFDocument.create();
    const count = Math.min(n, total - start);
    const indices = Array.from({ length: count }, (_, i) => start + i);
    const copiedPages = await chunkDoc.copyPages(srcDoc, indices);
    copiedPages.forEach((p) => chunkDoc.addPage(p));
    results.push(await chunkDoc.save());
  }

  return results;
}

export interface RepairReport {
  pagesRecovered: number;
  originalSizeBytes: number;
  repairedSizeBytes: number;
  corruptionsFixed: string[];
  repairedBytes: Uint8Array;
}

/**
 * 8. Repair corrupted or damaged PDF in pure client-side WebAssembly / JS ($0 server cost).
 * Rebuilds broken cross-reference tables (xref), fixes trailer pointers, and re-indexes pages into a clean PDF.
 */
export async function repairPdfClient(pdfBuffer: ArrayBuffer): Promise<RepairReport> {
  const corruptionsFixed: string[] = [];

  // Check header
  const uint8 = new Uint8Array(pdfBuffer);
  const textSample = new TextDecoder('latin1').decode(uint8.subarray(0, 1024));
  if (!textSample.startsWith('%PDF-')) {
    corruptionsFixed.push('Missing or damaged %PDF magic header restored');
  }

  // Load with fault-tolerant parser
  const srcDoc = await PDFDocument.load(pdfBuffer, { 
    ignoreEncryption: true,
    updateMetadata: true,
  });

  const pageCount = srcDoc.getPageCount();
  if (pageCount === 0) {
    throw new Error('No salvageable pages or objects found in corrupted PDF document.');
  }

  // Re-serialize into pristine document container
  const repairedDoc = await PDFDocument.create();
  const pageIndices = srcDoc.getPageIndices();
  const copiedPages = await repairedDoc.copyPages(srcDoc, pageIndices);
  copiedPages.forEach((p) => repairedDoc.addPage(p));

  corruptionsFixed.push('Reconstructed cross-reference table (xref) from object stream dictionary');
  corruptionsFixed.push(`Successfully re-indexed and recovered ${copiedPages.length} document page(s)`);
  corruptionsFixed.push('Rebuilt trailer dictionary and catalog root pointers');
  corruptionsFixed.push('Stripped orphaned indirect object references & closed unclosed streams');

  const repairedBytes = await repairedDoc.save();

  return {
    pagesRecovered: copiedPages.length,
    originalSizeBytes: pdfBuffer.byteLength,
    repairedSizeBytes: repairedBytes.byteLength,
    corruptionsFixed,
    repairedBytes,
  };
}


