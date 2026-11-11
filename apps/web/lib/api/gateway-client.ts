import { GATEWAY_URL, QueueUnavailableError, runServerJob, type ProgressHandler } from './jobs-client';

export type { ServerProgress, ProgressHandler } from './jobs-client';

export interface CompressOptions {
  optimizeLevel?: '1' | '2' | '3'; // 1=Low, 2=Medium (default), 3=Extreme
}

export interface OcrOptions {
  languages?: string; // e.g. 'eng', 'spa', 'fra', 'deu'
}

/**
 * Uploads a document to the EyeShots API Gateway and receives the processed file back as a Blob.
 */
export async function processServerTool(
  endpoint: string,
  files: File[],
  extraFields: Record<string, string> = {}
): Promise<Blob> {
  const formData = new FormData();

  for (const file of files) {
    formData.append('files', file);
  }

  for (const [key, value] of Object.entries(extraFields)) {
    formData.append(key, value);
  }

  let response: Response;
  try {
    response = await fetch(`${GATEWAY_URL}${endpoint}`, {
      method: 'POST',
      body: formData,
      credentials: 'include', // session cookie → per-plan limits
      signal: AbortSignal.timeout(5 * 60_000),
    });
  } catch (err) {
    if ((err as Error)?.name === 'TimeoutError') throw new Error('The server took too long to respond. Please try again with a smaller file.');
    throw new Error('Could not reach the EyeShots processing service. Check your connection and try again.');
  }

  if (!response.ok) {
    let errorDetail = `Processing failed (HTTP ${response.status})`;
    const text = await response.text().catch(() => '');
    try {
      const errJson = JSON.parse(text);
      errorDetail = errJson.error || errorDetail;
    } catch {
      if (text && text.length < 300) errorDetail = text;
    }
    if (response.status === 429) errorDetail = 'Too many requests. Please wait a minute, or upgrade to Pro for higher limits.';
    if (response.status === 413) errorDetail = 'This file is too large for your plan.';
    throw new Error(errorDetail);
  }

  return await response.blob();
}

/**
 * Runs a long server task through the async job queue (real upload progress,
 * queue position, retries on engine hiccups). Falls back to the synchronous
 * endpoint when the gateway has no queue configured.
 */
async function queuedOrSync(tool: string, files: File[], fields: Record<string, string>, onProgress?: ProgressHandler): Promise<Blob> {
  try {
    return (await runServerJob(tool, files, fields, onProgress)).blob;
  } catch (err) {
    if (!(err instanceof QueueUnavailableError)) throw err;
    onProgress?.({ phase: 'processing', percent: 50, message: 'Processing…' });
    const blob = await processServerTool(`/api/tools/${tool}`, files, fields);
    onProgress?.({ phase: 'done', percent: 100, message: 'Done' });
    return blob;
  }
}

/**
 * 1. Compress PDF via Stirling-PDF Ghostscript downsampling
 */
export async function compressPdfServer(file: File, options: CompressOptions = {}, onProgress?: ProgressHandler): Promise<Blob> {
  return queuedOrSync('compress', [file], { optimizeLevel: options.optimizeLevel || '2' }, onProgress);
}

/**
 * 2. OCR PDF via Tesseract 5 pipeline
 */
export async function ocrPdfServer(file: File, options: OcrOptions = {}, onProgress?: ProgressHandler): Promise<Blob> {
  return queuedOrSync('ocr', [file], { languages: options.languages || 'eng' }, onProgress);
}

/**
 * 3. Convert PDF to Microsoft Word (.docx)
 */
export async function pdfToWordServer(file: File, onProgress?: ProgressHandler): Promise<Blob> {
  return queuedOrSync('pdf-to-word', [file], {}, onProgress);
}

/**
 * 4/5. Protect & unlock stay synchronous on purpose: queuing them would store
 * the user's password in Redis job data. They are fast operations.
 */
/**
 * 4. Encrypt PDF with 256-bit AES Password
 */
export async function protectPdfServer(file: File, password: string): Promise<Blob> {
  return await processServerTool('/api/tools/protect', [file], { password });
}

/**
 * 5. Unlock / Decrypt PDF
 */
export async function unlockPdfServer(file: File, password: string): Promise<Blob> {
  return await processServerTool('/api/tools/unlock', [file], { password });
}

/**
 * 6. Repair Corrupted PDF (Rebuild damaged xref tables & recover via Stirling-PDF / QPDF)
 */
export async function repairPdfServer(file: File, onProgress?: ProgressHandler): Promise<Blob> {
  return queuedOrSync('repair', [file], {}, onProgress);
}

/**
 * 7. Convert Office documents (Word, Excel, PowerPoint, ODF) to PDF via LibreOffice
 */
export async function officeToPdfServer(file: File, onProgress?: ProgressHandler): Promise<Blob> {
  return queuedOrSync('office-to-pdf', [file], {}, onProgress);
}

/**
 * Download a generic Blob as a file with the specified name
 */
export function downloadFileBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
