import type { NextFunction, Request, Response } from 'express';
import crypto from 'crypto';

/**
 * Fixed-window, in-memory rate limiter keyed by client IP.
 * NOTE: per-process only. When running more than one gateway replica, move
 * this to Redis (e.g. INCR + EXPIRE on `rl:{bucket}:{ip}:{window}`).
 */
export function rateLimit(opts: { bucket: string; windowMs: number; max: number }) {
  const hits = new Map<string, { count: number; resetAt: number }>();
  setInterval(() => {
    const now = Date.now();
    for (const [k, v] of hits) if (v.resetAt <= now) hits.delete(k);
  }, opts.windowMs).unref();

  return (req: Request, res: Response, next: NextFunction) => {
    const key = req.ip || 'unknown';
    const now = Date.now();
    let entry = hits.get(key);
    if (!entry || entry.resetAt <= now) {
      entry = { count: 0, resetAt: now + opts.windowMs };
      hits.set(key, entry);
    }
    entry.count++;
    res.setHeader('RateLimit-Limit', String(opts.max));
    res.setHeader('RateLimit-Remaining', String(Math.max(0, opts.max - entry.count)));
    res.setHeader('RateLimit-Reset', String(Math.ceil((entry.resetAt - now) / 1000)));
    if (entry.count > opts.max) {
      res.setHeader('Retry-After', String(Math.ceil((entry.resetAt - now) / 1000)));
      return res.status(429).json({ error: 'Too many requests. Please slow down.' });
    }
    next();
  };
}

/** Adds a request id and baseline security headers to every response. */
export function baseHeaders(req: Request, res: Response, next: NextFunction) {
  const id = (req.headers['x-request-id'] as string) || crypto.randomUUID();
  (req as Request & { id: string }).id = id;
  res.setHeader('X-Request-Id', id);
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('Cache-Control', 'no-store'); // processed documents must never be cached by proxies
  next();
}

/** Constant-time bearer token check. */
export function requireBearer(token: string | undefined) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!token) return res.status(404).json({ error: 'Not found' });
    const header = req.headers.authorization || '';
    const given = header.startsWith('Bearer ') ? header.slice(7) : '';
    const a = Buffer.from(given);
    const b = Buffer.from(token);
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    next();
  };
}

// ── Upload validation ─────────────────────────────────────────────────

export function isPdf(buf: Buffer): boolean {
  // %PDF- may be preceded by a little junk; PDF readers accept it within the first 1 KB.
  return buf.subarray(0, 1024).includes('%PDF-');
}

const ZIP_MAGIC = Buffer.from([0x50, 0x4b, 0x03, 0x04]); // docx/xlsx/pptx/odt/ods/odp
const OLE_MAGIC = Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]); // legacy doc/xls/ppt

export const OFFICE_EXTENSIONS = new Set(['.docx', '.doc', '.odt', '.rtf', '.xlsx', '.xls', '.ods', '.csv', '.pptx', '.ppt', '.odp']);

export function isOfficeDocument(name: string, buf: Buffer): boolean {
  const ext = name.toLowerCase().slice(name.lastIndexOf('.'));
  if (!OFFICE_EXTENSIONS.has(ext)) return false;
  if (ext === '.rtf') return buf.subarray(0, 5).toString('latin1') === '{\\rtf';
  if (ext === '.csv') return !buf.subarray(0, 4096).includes(0); // plain text, no NUL bytes
  return buf.subarray(0, 4).equals(ZIP_MAGIC) || buf.subarray(0, 8).equals(OLE_MAGIC);
}

/** Strips path components and control characters from an uploaded filename. */
export function safeFilename(name: string): string {
  const base = name.split(/[\\/]/).pop() || 'document';
  return base.replace(/[\x00-\x1f"<>|:*?]/g, '_').slice(0, 180) || 'document';
}
