import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { query } from '../../src/db';
import { TEST_API_KEY } from './mock-stirling';
import { Client, PDF, pdfWith, clearEngineRequests, engineRequests, lastEngineRequest, startGateway, type Harness } from './harness';

let h: Harness;
beforeAll(async () => { h = await startGateway(); });
afterAll(async () => { await h.close(); });

const resetUsage = () => query('DELETE FROM usage_daily');

describe('synchronous tools', () => {
  it('proxies to the engine with the internal key and correct parameters', async () => {
    await resetUsage();
    const c = new Client(h.base);
    await clearEngineRequests();
    const r = await c.upload('/api/tools/compress', [{ name: 'report.pdf', data: PDF }], { optimizeLevel: '3' });
    expect(r.status).toBe(200);
    expect(r.headers.get('content-type')).toContain('application/pdf');
    expect(r.headers.get('cache-control')).toBe('no-store');
    const req = (await lastEngineRequest('/api/v1/misc/compress-pdf'))!;
    expect(req.endpoint).toBe('/api/v1/misc/compress-pdf');
    expect(req.apiKey).toBe(TEST_API_KEY);
    expect(req.fields.optimizeLevel).toBe('8');
  });

  it('validates file type and parameters before touching the engine', async () => {
    await resetUsage();
    const c = new Client(h.base);
    const before = (await engineRequests()).length;
    expect((await c.upload('/api/tools/compress', [{ name: 'x.pdf', data: Buffer.from('not a pdf') }])).status).toBe(415);
    expect((await c.upload('/api/tools/compress', [{ name: 'x.pdf', data: PDF }], { optimizeLevel: '7' })).status).toBe(400);
    expect((await c.upload('/api/tools/protect', [{ name: 'x.pdf', data: PDF }])).status).toBe(400);
    expect((await c.upload('/api/tools/merge', [{ name: 'x.pdf', data: PDF }])).status).toBe(400);
    expect((await c.upload('/api/tools/nope', [{ name: 'x.pdf', data: PDF }])).status).toBe(404);
    expect((await engineRequests()).length).toBe(before);
  });

  it('maps engine failures to safe client errors without leaking engine details', async () => {
    await resetUsage();
    const c = new Client(h.base);
    const rejected = await c.upload('/api/tools/repair', [{ name: 'x.pdf', data: pdfWith('ENGINE_REJECT') }]);
    expect(rejected.status).toBe(422);
    expect(JSON.stringify(rejected.json)).not.toContain('/tmp');
    expect(rejected.json.requestId).toBeTruthy();
    const dropped = await c.upload('/api/tools/repair', [{ name: 'x.pdf', data: pdfWith('ENGINE_DROP') }]);
    expect(dropped.status).toBe(503);
  });

  it('sends OCR languages as repeated fields', async () => {
    await resetUsage();
    const c = new Client(h.base);
    await c.upload('/api/tools/ocr', [{ name: 'scan.pdf', data: PDF }], { languages: 'eng+deu' });
    const req = (await lastEngineRequest('/api/v1/misc/ocr-pdf'))!;
    expect(req.fields.languages).toEqual(['eng', 'deu']);
    expect(req.fields.ocrType).toBe('skip-text');
  });
});

describe('quotas', () => {
  it('anonymous visitors get 3 cloud tasks per day, then 402 before the upload is processed', async () => {
    await resetUsage();
    const c = new Client(h.base);
    const statuses: number[] = [];
    for (let i = 0; i < 4; i++) statuses.push((await c.upload('/api/tools/compress', [{ name: 'a.pdf', data: PDF }])).status);
    expect(statuses).toEqual([200, 200, 200, 402]);
    const r = await c.upload('/api/tools/compress', [{ name: 'a.pdf', data: PDF }]);
    expect(r.json).toMatchObject({ code: 'QUOTA_EXCEEDED', upgradeUrl: '/pricing' });
    const subjects = await query<{ subject: string }>('SELECT subject FROM usage_daily');
    expect(subjects.every((s) => /^ip:[0-9a-f]{32}$/.test(s.subject))).toBe(true); // no raw IPs
  });

  it('signed-in users are metered separately from their IP', async () => {
    await resetUsage();
    const anon = new Client(h.base);
    for (let i = 0; i < 3; i++) await anon.upload('/api/tools/compress', [{ name: 'a.pdf', data: PDF }]);
    const user = new Client(h.base);
    await user.signIn('quota@example.com');
    expect((await user.upload('/api/tools/compress', [{ name: 'a.pdf', data: PDF }])).status).toBe(200);
    expect((await user.req('/api/account')).json.usage).toMatchObject({ cloudTasksToday: 1, cloudTasksPerDay: 3 });
  });

  it('parallel requests cannot exceed the limit (atomic increment)', async () => {
    await resetUsage();
    const c = new Client(h.base);
    const results = await Promise.all(
      Array.from({ length: 8 }, () => c.upload('/api/tools/compress', [{ name: 'a.pdf', data: pdfWith('ENGINE_SLOW') }])),
    );
    const ok = results.filter((r) => r.status === 200).length;
    expect(ok).toBe(3);
    expect(results.filter((r) => r.status === 402).length).toBe(5);
  });

  it('paid plans are unlimited', async () => {
    await resetUsage();
    const c = new Client(h.base);
    const id = await c.signIn('pro-quota@example.com');
    await query(`UPDATE users SET plan = 'pro', plan_status = 'active' WHERE id = $1`, [id]);
    for (let i = 0; i < 5; i++) expect((await c.upload('/api/tools/compress', [{ name: 'a.pdf', data: PDF }])).status).toBe(200);
  });
});

describe('health', () => {
  it('reports liveness and readiness (engine + queue)', async () => {
    expect((await (await fetch(`${h.base}/health`)).json()).status).toBe('ok');
    const ready = await (await fetch(`${h.base}/ready`)).json();
    expect(ready.status).toBe('ready');
    expect(ready.queue.enabled).toBe(true);
  });
});
