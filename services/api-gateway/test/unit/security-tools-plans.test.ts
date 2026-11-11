import { describe, it, expect, vi } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import type { Request, Response } from 'express';
import { isPdf, isOfficeDocument, safeFilename, rateLimit, requireBearer } from '../../src/security';
import { SERVER_TOOLS, baseName } from '../../src/tools';
import { PLAN_LIMITS, betterPlan, effectiveMaxFileMb, planForPrice } from '../../src/plans';
import { FsBlobStore } from '../../src/blob-store';
import { QUEUEABLE_TOOLS } from '../../src/queue';

const buf = (...parts: (string | number[])[]) => Buffer.concat(parts.map((p) => (typeof p === 'string' ? Buffer.from(p, 'latin1') : Buffer.from(p))));

describe('upload validation', () => {
  it('detects PDFs by magic bytes, tolerating leading junk', () => {
    expect(isPdf(buf('%PDF-1.7\n...'))).toBe(true);
    expect(isPdf(buf('\n\n  %PDF-1.4'))).toBe(true);
    expect(isPdf(buf('hello.pdf'))).toBe(false);
    expect(isPdf(Buffer.concat([Buffer.alloc(2000), buf('%PDF-')]))).toBe(false); // too far in
  });
  it('validates Office files by extension AND content', () => {
    const zip = buf([0x50, 0x4b, 0x03, 0x04], 'rest');
    const ole = buf([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]);
    expect(isOfficeDocument('a.docx', zip)).toBe(true);
    expect(isOfficeDocument('a.xls', ole)).toBe(true);
    expect(isOfficeDocument('a.rtf', buf('{\\rtf1 hi}'))).toBe(true);
    expect(isOfficeDocument('a.csv', buf('a,b\n1,2'))).toBe(true);
    expect(isOfficeDocument('a.csv', buf([0x00, 0x01]))).toBe(false); // binary disguised as csv
    expect(isOfficeDocument('a.docx', buf('MZ executable'))).toBe(false);
    expect(isOfficeDocument('a.exe', zip)).toBe(false);
  });
  it('sanitises file names (no paths, quotes or control chars)', () => {
    expect(safeFilename('../../etc/passwd')).toBe('passwd');
    expect(safeFilename('C:\\Users\\x\\report.pdf')).toBe('report.pdf');
    expect(safeFilename('a"b<c>\u0000.pdf')).toBe('a_b_c__.pdf');
    expect(safeFilename('')).toBe('document');
    expect(safeFilename('x'.repeat(500)).length).toBe(180);
  });
});

function mockRes() {
  const res: any = { headers: {} as Record<string, string>, statusCode: 200, body: undefined };
  res.setHeader = (k: string, v: string) => (res.headers[k] = v);
  res.status = (c: number) => ((res.statusCode = c), res);
  res.json = (b: unknown) => ((res.body = b), res);
  return res as Response & { headers: Record<string, string>; statusCode: number; body: any };
}

describe('rateLimit', () => {
  it('allows `max` requests per window per IP, then 429 with Retry-After', () => {
    const limiter = rateLimit({ bucket: 't', windowMs: 60_000, max: 2 });
    const next = vi.fn();
    const req = { ip: '1.2.3.4' } as Request;
    for (let i = 0; i < 2; i++) limiter(req, mockRes(), next);
    const res = mockRes();
    limiter(req, res, next);
    expect(next).toHaveBeenCalledTimes(2);
    expect(res.statusCode).toBe(429);
    expect(Number(res.headers['Retry-After'])).toBeGreaterThan(0);
    limiter({ ip: '5.6.7.8' } as Request, mockRes(), next); // other IPs unaffected
    expect(next).toHaveBeenCalledTimes(3);
  });
});

describe('requireBearer', () => {
  const run = (token: string | undefined, header?: string) => {
    const res = mockRes();
    const next = vi.fn();
    requireBearer(token)({ headers: header ? { authorization: header } : {} } as Request, res, next);
    return { res, next };
  };
  it('hides the endpoint entirely when no token is configured', () => {
    expect(run(undefined, 'Bearer x').res.statusCode).toBe(404);
  });
  it('accepts only the exact token', () => {
    const token = 'a'.repeat(32);
    expect(run(token, `Bearer ${token}`).next).toHaveBeenCalled();
    expect(run(token, `Bearer ${'b'.repeat(32)}`).res.statusCode).toBe(401);
    expect(run(token, `Bearer short`).res.statusCode).toBe(401);
    expect(run(token).res.statusCode).toBe(401);
  });
});

describe('server tool registry', () => {
  const fields = (id: string, body: Record<string, unknown>) => {
    const t = SERVER_TOOLS[id];
    return t.fields(t.params.parse(body));
  };
  it('maps UI compression levels onto Stirling’s 1–9 scale', () => {
    expect(fields('compress', {})).toEqual({ optimizeLevel: 5 });
    expect(fields('compress', { optimizeLevel: '1' })).toEqual({ optimizeLevel: 3 });
    expect(fields('compress', { optimizeLevel: '3' })).toEqual({ optimizeLevel: 8 });
    expect(SERVER_TOOLS.compress.params.safeParse({ optimizeLevel: '9' }).success).toBe(false);
  });
  it('sends multiple OCR languages as separate fields and skips text pages', () => {
    const f = fields('ocr', { languages: 'eng+deu' });
    expect(f.languages).toEqual(['eng', 'deu']);
    expect(f.ocrType).toBe('skip-text');
    expect(SERVER_TOOLS.ocr.params.safeParse({ languages: 'eng; rm -rf /' }).success).toBe(false);
  });
  it('builds Bates numbering with start number and zero padding', () => {
    expect(fields('bates-numbering', { prefix: 'CASE-', startNumber: '42', digits: '5' })).toMatchObject({
      customText: 'CASE-{n}', startingNumber: 42, zeroPad: 5, position: 9,
    });
    expect(SERVER_TOOLS['bates-numbering'].params.safeParse({ prefix: '<script>' }).success).toBe(false);
  });
  it('requires a password for protect/unlock and never queues them', () => {
    expect(SERVER_TOOLS.protect.params.safeParse({}).success).toBe(false);
    expect(QUEUEABLE_TOOLS.has('protect')).toBe(false);
    expect(QUEUEABLE_TOOLS.has('unlock')).toBe(false);
    expect(QUEUEABLE_TOOLS.has('ocr')).toBe(true);
  });
  it('names outputs from the input base name', () => {
    expect(baseName('C:\\x\\Quarterly Report.final.pdf')).toBe('Quarterly Report.final');
    expect(SERVER_TOOLS['pdf-to-word'].outputName('report')).toBe('report.docx');
    expect(SERVER_TOOLS['office-to-pdf'].outputName('sheet')).toBe('sheet.pdf');
  });
});

describe('plans', () => {
  it('maps configured Stripe prices to plans and ignores unknown ones', () => {
    expect(planForPrice(undefined)).toBeNull();
    expect(planForPrice('price_unknown')).toBeNull();
  });
  it('ranks plans', () => {
    expect(betterPlan('free', 'pro')).toBe('pro');
    expect(betterPlan('team', 'pro')).toBe('team');
  });
  it('never allows more than the gateway buffers (MAX_UPLOAD_MB)', () => {
    expect(effectiveMaxFileMb('pro')).toBeLessThanOrEqual(PLAN_LIMITS.pro.maxFileMb);
    expect(effectiveMaxFileMb('anonymous')).toBe(Math.min(100, Number(process.env.MAX_UPLOAD_MB ?? 100)));
  });
  it('pricing page copy matches the enforced free-tier quota', () => {
    const web = fs.readFileSync(path.resolve(__dirname, '../../../../apps/web/lib/plans.ts'), 'utf8');
    expect(web).toContain(`${PLAN_LIMITS.free.cloudTasksPerDay} cloud tasks per day`);
    expect(web).toContain(`Files up to ${PLAN_LIMITS.free.maxFileMb} MB`);
  });
});

describe('FsBlobStore', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'es-blob-'));
  const store = new FsBlobStore(dir);
  const key = '11111111-1111-4111-8111-111111111111/in-0';

  it('round-trips and deletes blobs', async () => {
    await store.put(key, Buffer.from('hello'));
    expect((await store.getBuffer(key)).toString()).toBe('hello');
    expect((await store.get(key)).size).toBe(5);
    await store.delete(key);
    await expect(store.getBuffer(key)).rejects.toThrow();
  });
  it('rejects path traversal in keys', async () => {
    await expect(store.put('../evil', Buffer.from('x'))).rejects.toThrow(/Invalid blob key/);
    await expect(store.put('a/../../b', Buffer.from('x'))).rejects.toThrow(/Invalid blob key/);
  });
  it('sweeps only expired blobs', async () => {
    await store.put(key, Buffer.from('old'));
    await store.put('22222222-2222-4222-8222-222222222222/out', Buffer.from('new'));
    const old = new Date(Date.now() - 3 * 3600_000);
    fs.utimesSync(path.join(dir, key.replace('/', '__')), old, old);
    expect(await store.sweepExpired(110 * 60_000)).toBe(1);
    expect(fs.readdirSync(dir)).toEqual(['22222222-2222-4222-8222-222222222222__out']);
  });
});
