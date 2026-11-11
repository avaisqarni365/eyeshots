import * as pdfjsLib from 'pdfjs-dist';

/**
 * Central pdf.js configuration. Worker, CMaps and standard fonts are all
 * self-hosted under /public so no document-related request ever reaches a CDN
 * (privacy) and everything works offline in the Tauri desktop build.
 *
 * IMPORTANT: pdf.js *transfers* the ArrayBuffer you pass as `data` to its
 * worker, which detaches it. Always pass a copy (`bytes.slice()`) if you need
 * the bytes again afterwards (e.g. for pdf-lib).
 */
export const PDFJS_DOC_OPTIONS = {
  cMapUrl: '/pdfjs/cmaps/',
  cMapPacked: true,
  standardFontDataUrl: '/pdfjs/standard_fonts/',
} as const;

export function ensurePdfjsWorker(): void {
  if (typeof window !== 'undefined' && !pdfjsLib.GlobalWorkerOptions.workerSrc) {
    pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';
  }
}
