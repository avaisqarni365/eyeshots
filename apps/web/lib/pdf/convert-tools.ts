/**
 * Client-side (zero-upload) implementations for Crop, Images→PDF and PDF→Images.
 * All functions run entirely in the browser using pdf-lib and pdf.js.
 */
import { PDFDocument, PageSizes } from 'pdf-lib';
import * as pdfjsLib from 'pdfjs-dist';
import { ensurePdfjsWorker, PDFJS_DOC_OPTIONS } from './pdfjs-setup';

import { MM_TO_PT, toUnrotated, jpegOrientation, type Margins } from './geometry';

export type { Margins };

/** Detects the bounding box of non-white content on a rendered page; returns visual margins in mm. */
async function detectContentMargins(page: pdfjsLib.PDFPageProxy, paddingMm: number): Promise<Margins> {
  const viewport = page.getViewport({ scale: 1 }); // 1 css px == 1 pt
  const canvas = document.createElement('canvas');
  canvas.width = Math.ceil(viewport.width);
  canvas.height = Math.ceil(viewport.height);
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  await page.render({ canvasContext: ctx, viewport }).promise;
  const { data, width, height } = ctx.getImageData(0, 0, canvas.width, canvas.height);

  let minX = width, minY = height, maxX = -1, maxY = -1;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      if (data[i] < 245 || data[i + 1] < 245 || data[i + 2] < 245) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  canvas.width = canvas.height = 0;
  if (maxX < 0) return { top: 0, right: 0, bottom: 0, left: 0 }; // blank page
  const pad = paddingMm * MM_TO_PT;
  const toMm = (pt: number) => Math.max(0, (pt - pad) / MM_TO_PT);
  return { top: toMm(minY), left: toMm(minX), right: toMm(width - 1 - maxX), bottom: toMm(height - 1 - maxY) };
}

export async function cropPdfClient(
  file: File,
  opts: { mode: 'manual'; margins: Margins } | { mode: 'auto'; paddingMm: number },
  onProgress?: (done: number, total: number) => void,
): Promise<Uint8Array> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  const doc = await PDFDocument.load(bytes, { ignoreEncryption: true });
  const pages = doc.getPages();

  let pdfjsDoc: pdfjsLib.PDFDocumentProxy | null = null;
  if (opts.mode === 'auto') {
    ensurePdfjsWorker();
    // pdf.js transfers (detaches) the buffer it is given, so always pass a copy.
    pdfjsDoc = await pdfjsLib.getDocument({ ...PDFJS_DOC_OPTIONS, data: bytes.slice() }).promise;
  }

  try {
    for (let i = 0; i < pages.length; i++) {
      const page = pages[i];
      const box = page.getCropBox();
      const visual = opts.mode === 'manual' ? opts.margins : await detectContentMargins(await pdfjsDoc!.getPage(i + 1), opts.paddingMm);
      const m = toUnrotated(visual, page.getRotation().angle);
      const l = m.left * MM_TO_PT, r = m.right * MM_TO_PT, t = m.top * MM_TO_PT, b = m.bottom * MM_TO_PT;
      const w = box.width - l - r;
      const h = box.height - t - b;
      if (w < 10 || h < 10) throw new Error(`Margins are larger than page ${i + 1}. Reduce the crop amount.`);
      page.setCropBox(box.x + l, box.y + b, w, h);
      page.setTrimBox(box.x + l, box.y + b, w, h);
      onProgress?.(i + 1, pages.length);
    }
  } finally {
    await pdfjsDoc?.destroy();
  }
  return doc.save();
}

// ── Images → PDF ──────────────────────────────────────────────────────

export type PageSizeOption = 'fit' | 'a4' | 'letter';
export type OrientationOption = 'auto' | 'portrait' | 'landscape';

/** Decodes any browser-supported image (honouring EXIF rotation) and re-encodes it. */
async function rasterize(file: File, type: 'image/jpeg' | 'image/png'): Promise<ArrayBuffer> {
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' } as ImageBitmapOptions);
  const canvas = document.createElement('canvas');
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  const ctx = canvas.getContext('2d')!;
  if (type === 'image/jpeg') {
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }
  ctx.drawImage(bitmap, 0, 0);
  bitmap.close();
  const blob = await new Promise<Blob>((res, rej) => canvas.toBlob((b) => (b ? res(b) : rej(new Error('Image encoding failed'))), type, 0.92));
  canvas.width = canvas.height = 0;
  return blob.arrayBuffer();
}

export async function imagesToPdfClient(
  files: File[],
  opts: { pageSize: PageSizeOption; orientation: OrientationOption; marginMm: number },
  onProgress?: (done: number, total: number) => void,
): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.setProducer('EyeShots');
  doc.setCreator('EyeShots Images to PDF');
  const margin = opts.marginMm * MM_TO_PT;

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const name = file.name.toLowerCase();
    const buf = await file.arrayBuffer();
    const isJpeg = file.type === 'image/jpeg' || /\.jpe?g$/.test(name);
    const isPng = file.type === 'image/png' || name.endsWith('.png');

    let image;
    if (isJpeg && jpegOrientation(buf) === 1) image = await doc.embedJpg(buf); // lossless pass-through
    else if (isPng) image = await doc.embedPng(buf);
    else if (isJpeg) image = await doc.embedJpg(await rasterize(file, 'image/jpeg'));
    else image = await doc.embedPng(await rasterize(file, 'image/png')); // webp, gif, bmp…

    const iw = image.width, ih = image.height;
    let pw: number, ph: number;
    if (opts.pageSize === 'fit') {
      pw = iw * 0.75 + margin * 2; // px @96dpi → pt
      ph = ih * 0.75 + margin * 2;
    } else {
      [pw, ph] = opts.pageSize === 'a4' ? PageSizes.A4 : PageSizes.Letter;
      const landscape = opts.orientation === 'landscape' || (opts.orientation === 'auto' && iw > ih);
      if (landscape) [pw, ph] = [ph, pw];
    }
    const page = doc.addPage([pw, ph]);
    const maxW = pw - margin * 2, maxH = ph - margin * 2;
    const scale = Math.min(maxW / iw, maxH / ih, opts.pageSize === 'fit' ? 0.75 : Infinity);
    const dw = iw * scale, dh = ih * scale;
    page.drawImage(image, { x: (pw - dw) / 2, y: (ph - dh) / 2, width: dw, height: dh });
    onProgress?.(i + 1, files.length);
  }
  return doc.save();
}

// ── PDF → Images ──────────────────────────────────────────────────────

export async function pdfToImagesClient(
  file: File,
  opts: { dpi: number; format: 'jpeg' | 'png'; quality?: number; pages?: number[] },
  onImage: (pageNumber: number, blob: Blob, total: number) => void | Promise<void>,
  signal?: AbortSignal,
): Promise<number> {
  ensurePdfjsWorker();
  const data = new Uint8Array(await file.arrayBuffer());
  const pdf = await pdfjsLib.getDocument({ ...PDFJS_DOC_OPTIONS, data }).promise;
  try {
    const pages = opts.pages?.length ? opts.pages : Array.from({ length: pdf.numPages }, (_, i) => i + 1);
    const scale = opts.dpi / 72;
    for (const n of pages) {
      if (signal?.aborted) throw new DOMException('Cancelled', 'AbortError');
      const page = await pdf.getPage(n);
      const viewport = page.getViewport({ scale });
      const canvas = document.createElement('canvas');
      canvas.width = Math.floor(viewport.width);
      canvas.height = Math.floor(viewport.height);
      const ctx = canvas.getContext('2d')!;
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      await page.render({ canvasContext: ctx, viewport }).promise;
      const mime = opts.format === 'png' ? 'image/png' : 'image/jpeg';
      const blob = await new Promise<Blob>((res, rej) => canvas.toBlob((b) => (b ? res(b) : rej(new Error('Rendering failed'))), mime, opts.quality ?? 0.9));
      canvas.width = canvas.height = 0;
      page.cleanup();
      await onImage(n, blob, pages.length);
    }
    return pdf.numPages;
  } finally {
    await pdf.destroy();
  }
}

export async function countPdfPages(file: File): Promise<number> {
  const doc = await PDFDocument.load(await file.arrayBuffer(), { ignoreEncryption: true });
  return doc.getPageCount();
}
