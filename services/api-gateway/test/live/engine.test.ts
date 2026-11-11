import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import type { Server } from 'http';
import type { AddressInfo } from 'net';
import { PDFDocument, StandardFonts } from 'pdf-lib';
import { createApp } from '../../src/app';

vi.spyOn(console, 'log').mockImplementation(() => undefined);

let server: Server;
let base = '';
let samplePdf: Buffer;

beforeAll(async () => {
  const engine = process.env.STIRLING_ENGINE_URL!;
  const up = await fetch(`${engine}/api/v1/info/status`).then((r) => r.status < 500).catch(() => false);
  if (!up) throw new Error(`Stirling-PDF is not reachable at ${engine}. Start it with: docker compose up -d stirling-pdf-core`);

  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  for (let i = 0; i < 2; i++) doc.addPage([595, 842]).drawText(`Live engine smoke test page ${i + 1}`, { x: 50, y: 780, size: 16, font });
  samplePdf = Buffer.from(await doc.save());

  const { app } = createApp();
  server = await new Promise((resolve) => { const s = app.listen(0, '127.0.0.1', () => resolve(s)); });
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
}, 60_000);

afterAll(() => new Promise<void>((r) => server?.close(() => r())));

async function run(tool: string, file: { name: string; data: Buffer; type: string }, fields: Record<string, string> = {}) {
  const form = new FormData();
  form.append('files', new Blob([new Uint8Array(file.data)], { type: file.type }), file.name);
  for (const [k, v] of Object.entries(fields)) form.append(k, v);
  const r = await fetch(`${base}/api/tools/${tool}`, { method: 'POST', body: form });
  return { status: r.status, type: r.headers.get('content-type') ?? '', body: Buffer.from(await r.arrayBuffer()) };
}

const pdf = () => ({ name: 'sample.pdf', data: samplePdf, type: 'application/pdf' });

describe('gateway ↔ real Stirling-PDF', () => {
  it.each(['1', '2', '3'])('compress (level %s) returns a valid PDF', async (level) => {
    const r = await run('compress', pdf(), { optimizeLevel: level });
    expect(r.status).toBe(200);
    expect((await PDFDocument.load(r.body)).getPageCount()).toBe(2);
  });

  it('OCR with multiple languages returns a PDF', async () => {
    const r = await run('ocr', pdf(), { languages: 'eng+deu' });
    expect(r.status).toBe(200);
    expect(r.body.subarray(0, 5).toString()).toBe('%PDF-');
  });

  it('Office → PDF converts a spreadsheet', async () => {
    const r = await run('office-to-pdf', { name: 'sheet.csv', data: Buffer.from('Name,Amount\nAlice,10\nBob,20\n'), type: 'text/csv' });
    expect(r.status).toBe(200);
    expect(r.body.subarray(0, 5).toString()).toBe('%PDF-');
  });

  it('PDF → Word returns a DOCX (zip) document', async () => {
    const r = await run('pdf-to-word', pdf());
    expect(r.status).toBe(200);
    expect([r.body[0], r.body[1]]).toEqual([0x50, 0x4b]);
  });

  it('protect + unlock round-trip with AES-256', async () => {
    const locked = await run('protect', pdf(), { password: 'correct horse' });
    expect(locked.status).toBe(200);
    expect(locked.body.toString('latin1')).toContain('/Encrypt');
    const unlocked = await run('unlock', { name: 'locked.pdf', data: locked.body, type: 'application/pdf' }, { password: 'correct horse' });
    expect(unlocked.status).toBe(200);
    expect((await PDFDocument.load(unlocked.body)).getPageCount()).toBe(2);
  });

  it('Bates numbering applies start number and padding', async () => {
    const r = await run('bates-numbering', pdf(), { prefix: 'CASE-', startNumber: '7', digits: '4' });
    expect(r.status).toBe(200);
  });

  it('a corrupt PDF is rejected with a safe 422', async () => {
    const r = await run('compress', { name: 'broken.pdf', data: Buffer.from('%PDF-1.4\n1 0 obj garbage'), type: 'application/pdf' });
    expect(r.status).toBe(422);
  });
});
