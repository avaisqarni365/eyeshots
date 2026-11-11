/**
 * Client for the gateway's async job API (/api/jobs).
 *
 * Flow: upload (XHR, real upload progress) → poll status with backoff (queue
 * position + worker progress) → download result → DELETE the job so the server
 * copy is removed immediately rather than waiting for the 2-hour sweeper.
 *
 * If the server has no queue (503 QUEUE_DISABLED), callers fall back to the
 * synchronous /api/tools endpoint transparently.
 */

export const GATEWAY_URL = process.env.NEXT_PUBLIC_GATEWAY_URL || 'http://localhost:4000';

export type ServerPhase = 'uploading' | 'queued' | 'processing' | 'downloading' | 'done';

export interface ServerProgress {
  phase: ServerPhase;
  /** Overall progress 0–100 across all phases. */
  percent: number;
  /** Human-readable status line for the UI. */
  message: string;
  queuePosition?: number;
}

export type ProgressHandler = (p: ServerProgress) => void;

export class QueueUnavailableError extends Error {}

interface JobStatus {
  state: 'waiting' | 'prioritized' | 'active' | 'delayed' | 'completed' | 'failed' | string;
  progress?: { stage: string; percent: number };
  queuePosition?: number;
  attempts?: number;
  error?: string;
  result?: { filename: string; contentType: string; size: number; downloadUrl: string };
}

function errorFromBody(status: number, text: string): Error {
  let message = `Processing failed (HTTP ${status})`;
  try {
    const json = JSON.parse(text);
    if (json.error) message = json.error;
  } catch {
    if (text && text.length < 300) message = text;
  }
  if (status === 429) message = 'Too many requests. Please wait a minute, or upgrade to Pro for higher limits.';
  if (status === 413) message = 'This file is too large for your plan.';
  return new Error(message);
}

function upload(tool: string, files: File[], fields: Record<string, string>, onProgress?: ProgressHandler, signal?: AbortSignal): Promise<{ jobId: string }> {
  return new Promise((resolve, reject) => {
    const form = new FormData();
    files.forEach((f) => form.append('files', f));
    Object.entries(fields).forEach(([k, v]) => form.append(k, v));

    const xhr = new XMLHttpRequest();
    xhr.open('POST', `${GATEWAY_URL}/api/jobs/${encodeURIComponent(tool)}`);
    xhr.withCredentials = true; // send the session cookie so plan limits apply
    xhr.upload.onprogress = (e) => {
      if (!e.lengthComputable) return;
      const pct = e.loaded / e.total;
      onProgress?.({ phase: 'uploading', percent: Math.round(pct * 30), message: `Uploading… ${Math.round(pct * 100)}%` });
    };
    xhr.onload = () => {
      if (xhr.status === 503) {
        try {
          if (JSON.parse(xhr.responseText).code === 'QUEUE_DISABLED') return reject(new QueueUnavailableError());
        } catch {}
      }
      if (xhr.status !== 202) return reject(errorFromBody(xhr.status, xhr.responseText));
      try {
        resolve(JSON.parse(xhr.responseText));
      } catch {
        reject(new Error('Unexpected response from server.'));
      }
    };
    xhr.onerror = () => reject(new Error('Could not reach the EyeShots processing service. Check your connection and try again.'));
    xhr.onabort = () => reject(new DOMException('Cancelled', 'AbortError'));
    signal?.addEventListener('abort', () => xhr.abort(), { once: true });
    xhr.send(form);
  });
}

const sleep = (ms: number, signal?: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    const t = setTimeout(resolve, ms);
    signal?.addEventListener('abort', () => { clearTimeout(t); reject(new DOMException('Cancelled', 'AbortError')); }, { once: true });
  });

/** Best-effort removal of the server-side copy. */
export function deleteJob(jobId: string): void {
  fetch(`${GATEWAY_URL}/api/jobs/${jobId}`, { method: 'DELETE', keepalive: true, credentials: 'include' }).catch(() => undefined);
}

const STAGE_MESSAGES: Record<string, string> = {
  starting: 'Starting…',
  loading: 'Preparing your document…',
  processing: 'Processing…',
  saving: 'Finishing up…',
  done: 'Finishing up…',
};

/**
 * Runs a server tool through the job queue. Throws QueueUnavailableError when
 * the server has no queue configured so the caller can use the sync endpoint.
 */
export async function runServerJob(
  tool: string,
  files: File[],
  fields: Record<string, string> = {},
  onProgress?: ProgressHandler,
  signal?: AbortSignal,
): Promise<{ blob: Blob; filename: string }> {
  onProgress?.({ phase: 'uploading', percent: 0, message: 'Uploading…' });
  const { jobId } = await upload(tool, files, fields, onProgress, signal);

  try {
    let delay = 800;
    const deadline = Date.now() + 15 * 60_000;
    let notFound = 0;
     
    while (true) {
      if (Date.now() > deadline) throw new Error('Processing is taking unusually long. Please try again later.');
      await sleep(delay, signal);
      delay = Math.min(delay * 1.3, 3000);

      const res = await fetch(`${GATEWAY_URL}/api/jobs/${jobId}`, { signal, cache: 'no-store', credentials: 'include' });
      if (res.status === 404 && ++notFound < 3) continue; // tolerate replication lag
      if (!res.ok) throw errorFromBody(res.status, await res.text());
      const s: JobStatus = await res.json();

      if (s.state === 'completed' && s.result) {
        onProgress?.({ phase: 'downloading', percent: 92, message: 'Downloading result…' });
        const dl = await fetch(`${GATEWAY_URL}${s.result.downloadUrl}`, { signal, credentials: 'include' });
        if (!dl.ok) throw errorFromBody(dl.status, await dl.text());
        const blob = await dl.blob();
        onProgress?.({ phase: 'done', percent: 100, message: 'Done' });
        return { blob, filename: s.result.filename };
      }
      if (s.state === 'failed') throw new Error(s.error || 'Processing failed.');

      if (s.state === 'waiting' || s.state === 'prioritized') {
        const pos = s.queuePosition ?? 1;
        onProgress?.({ phase: 'queued', percent: 30, queuePosition: pos, message: pos <= 1 ? 'Next in line…' : `In queue — position ${pos}` });
      } else if (s.state === 'delayed') {
        onProgress?.({ phase: 'queued', percent: 30, message: 'Engine busy — retrying shortly…' });
      } else {
        const worker = s.progress?.percent ?? 0;
        onProgress?.({
          phase: 'processing',
          percent: 30 + Math.round((worker / 100) * 60),
          message: STAGE_MESSAGES[s.progress?.stage ?? 'processing'] ?? 'Processing…',
        });
      }
    }
  } finally {
    // Always ask the server to drop its copy (input + result), success or not.
    deleteJob(jobId);
  }
}
