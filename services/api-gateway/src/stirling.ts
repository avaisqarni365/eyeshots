import axios from 'axios';
import FormData from 'form-data';
import { config } from './config';
import { safeFilename } from './security';

export interface InputFile {
  buffer: Buffer;
  filename: string;
  contentType: string;
}

export type FieldValue = string | number | boolean | string[] | undefined;

export interface StirlingResult {
  buffer: Buffer;
  contentType: string;
  /** Filename suggested by Stirling's Content-Disposition, if any. */
  filename?: string;
}

/** Error from the engine, classified so callers can map it to HTTP codes / retry policy. */
export class StirlingError extends Error {
  constructor(
    message: string,
    /** 'rejected' = engine refused the input (4xx, don't retry); 'timeout' / 'unavailable' / 'failed' are retryable. */
    readonly kind: 'rejected' | 'timeout' | 'unavailable' | 'failed',
    readonly status?: number,
    readonly detail?: string,
  ) {
    super(message);
  }
}

function filenameFromDisposition(header: unknown): string | undefined {
  if (typeof header !== 'string') return undefined;
  const star = header.match(/filename\*=UTF-8''([^;]+)/i);
  if (star) {
    try { return decodeURIComponent(star[1]); } catch {}
  }
  return header.match(/filename="?([^";]+)"?/i)?.[1];
}

export async function callStirling(endpoint: string, files: InputFile[], fields: Record<string, FieldValue>): Promise<StirlingResult> {
  const form = new FormData();
  for (const f of files) form.append('fileInput', f.buffer, { filename: safeFilename(f.filename), contentType: f.contentType || 'application/octet-stream' });
  for (const [key, value] of Object.entries(fields)) {
    if (value === undefined) continue;
    if (Array.isArray(value)) value.forEach((v) => form.append(key, v));
    else form.append(key, String(value));
  }

  try {
    const res = await axios.post(`${config.STIRLING_ENGINE_URL}${endpoint}`, form, {
      headers: { ...form.getHeaders(), 'X-API-KEY': config.INTERNAL_STIRLING_API_KEY },
      responseType: 'arraybuffer',
      timeout: config.STIRLING_TIMEOUT_MS,
      maxContentLength: 1024 * 1024 * 1024,
      maxBodyLength: 1024 * 1024 * 1024,
    });
    const ct = res.headers['content-type'];
    return {
      buffer: Buffer.from(res.data),
      contentType: typeof ct === 'string' ? ct : 'application/pdf',
      filename: filenameFromDisposition(res.headers['content-disposition']),
    };
  } catch (error: any) {
    const status: number | undefined = error.response?.status;
    const detail = error.response?.data ? Buffer.from(error.response.data).toString('utf-8').slice(0, 500) : error.message;
    if (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT') throw new StirlingError('Processing timed out.', 'timeout', status, detail);
    if (!error.response) throw new StirlingError('The processing engine is unavailable.', 'unavailable', undefined, detail);
    if (status && status >= 400 && status < 500) {
      throw new StirlingError('The document could not be processed. It may be damaged, encrypted, or use unsupported features.', 'rejected', status, detail);
    }
    throw new StirlingError('Processing failed.', 'failed', status, detail);
  }
}
