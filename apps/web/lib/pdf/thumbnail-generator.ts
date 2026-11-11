import * as pdfjsLib from 'pdfjs-dist';

// Ensure worker is set up
if (typeof window !== 'undefined') {
  pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';
}

/**
 * Render a single page of a loaded PDF document to a data URL thumbnail image.
 */
export async function renderPageThumbnail(
  pdfDoc: pdfjsLib.PDFDocumentProxy,
  pageNumber: number,
  targetWidth: number = 220
): Promise<string> {
  const page = await pdfDoc.getPage(pageNumber);
  const unscaledViewport = page.getViewport({ scale: 1 });
  const scale = targetWidth / unscaledViewport.width;
  const viewport = page.getViewport({ scale });

  const canvas = document.createElement('canvas');
  canvas.width = Math.floor(viewport.width);
  canvas.height = Math.floor(viewport.height);

  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Failed to get 2D canvas context');

  // Fill clean white background
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const renderContext = {
    canvasContext: ctx,
    viewport: viewport,
  };

  await page.render(renderContext).promise;
  return canvas.toDataURL('image/jpeg', 0.85);
}

/**
 * Render thumbnails for all pages of a PDF Document in parallel (capped concurrency)
 */
export async function renderAllPageThumbnails(
  fileOrBuffer: File | ArrayBuffer,
  targetWidth: number = 220,
  onProgress?: (current: number, total: number) => void
): Promise<{ doc: pdfjsLib.PDFDocumentProxy; thumbnails: Record<number, string> }> {
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
  const total = doc.numPages;
  const thumbnails: Record<number, string> = {};

  for (let i = 1; i <= total; i++) {
    try {
      const url = await renderPageThumbnail(doc, i, targetWidth);
      thumbnails[i] = url;
      if (onProgress) onProgress(i, total);
    } catch (err) {
      console.warn(`Failed to render thumbnail for page ${i}:`, err);
    }
  }

  return { doc, thumbnails };
}
