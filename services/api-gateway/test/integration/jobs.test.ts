import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'fs';
import IORedis from 'ioredis';
import { query } from '../../src/db';
import { createWorker } from '../../src/worker-core';
import { config } from '../../src/config';
import { getQueue } from '../../src/queue';
import { Client, PDF, pdfWith, startGateway, type Harness } from './harness';

let h: Harness;
let worker: ReturnType<typeof createWorker>;

beforeAll(async () => {
  // Fresh queue state in the dedicated test Redis DB.
  const redis = new IORedis(config.REDIS_URL!);
  await redis.flushdb();
  redis.disconnect();
  h = await startGateway();
  worker = createWorker({ concurrency: 2 });
});
afterAll(async () => {
  // Drain leftovers so no job from this file reaches the engine during later files.
  await getQueue().obliterate({ force: true });
  await worker.worker.close();
  worker.connection.disconnect();
  await h.close();
});

const storeFiles = () => (fs.existsSync(config.JOB_STORE_DIR) ? fs.readdirSync(config.JOB_STORE_DIR) : []);

async function waitFor(c: Client, jobId: string, timeoutMs = 20_000) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeoutMs) {
    const s = await c.req(`/api/jobs/${jobId}`);
    if (s.json.state === 'completed' || s.json.state === 'failed') return s.json;
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error(`job ${jobId} did not finish`);
}

describe('job queue', () => {
  it('runs the full lifecycle and leaves no files behind', async () => {
    await query('DELETE FROM usage_daily');
    const c = new Client(h.base);
    const sub = await c.upload('/api/jobs/compress', [{ name: 'report.pdf', data: PDF }], { optimizeLevel: '2' });
    expect(sub.status).toBe(202);
    expect(sub.headers.get('location')).toBe(`/api/jobs/${sub.json.jobId}`);

    const done = await waitFor(c, sub.json.jobId);
    expect(done.state).toBe('completed');
    expect(done.progress).toMatchObject({ stage: 'done', percent: 100 });
    expect(done.result).toMatchObject({ filename: 'report-compressed.pdf', downloadUrl: `/api/jobs/${sub.json.jobId}/download` });
    expect(storeFiles().filter((f) => f.startsWith(sub.json.jobId))).toEqual([`${sub.json.jobId}__out`]); // input already gone

    const dl = await fetch(`${h.base}${done.result.downloadUrl}`);
    expect(dl.headers.get('content-disposition')).toContain('report-compressed.pdf');
    expect(Buffer.from(await dl.arrayBuffer()).subarray(0, 5).toString()).toBe('%PDF-');

    expect((await c.req(`/api/jobs/${sub.json.jobId}`, { method: 'DELETE' })).status).toBe(204);
    expect(storeFiles().filter((f) => f.startsWith(sub.json.jobId))).toEqual([]);
    expect((await c.req(`/api/jobs/${sub.json.jobId}`)).status).toBe(404);
  });

  it('fails engine-rejected input immediately (no retries) and cleans up', async () => {
    await query('DELETE FROM usage_daily');
    const c = new Client(h.base);
    const sub = await c.upload('/api/jobs/repair', [{ name: 'broken.pdf', data: pdfWith('ENGINE_REJECT') }]);
    const done = await waitFor(c, sub.json.jobId);
    expect(done.state).toBe('failed');
    expect(done.attempts).toBe(1);
    expect(done.error).toMatch(/could not be processed/);
    await new Promise((r) => setTimeout(r, 300));
    expect(storeFiles().filter((f) => f.startsWith(sub.json.jobId))).toEqual([]);
  });

  it('keeps passwords out of the queue', async () => {
    await query('DELETE FROM usage_daily');
    const r = await new Client(h.base).upload('/api/jobs/protect', [{ name: 'a.pdf', data: PDF }], { password: 'secret' });
    expect(r.status).toBe(400);
    expect(r.json.syncUrl).toBe('/api/tools/protect');
  });

  it('jobs of signed-in users are visible only to their owner', async () => {
    await query('DELETE FROM usage_daily');
    const owner = new Client(h.base);
    await owner.signIn('job-owner@example.com');
    const sub = await owner.upload('/api/jobs/compress', [{ name: 'mine.pdf', data: PDF }]);
    await waitFor(owner, sub.json.jobId);
    const stranger = new Client(h.base);
    await stranger.signIn('stranger@example.com');
    expect((await stranger.req(`/api/jobs/${sub.json.jobId}`)).status).toBe(404);
    expect((await fetch(`${h.base}/api/jobs/${sub.json.jobId}/download`)).status).toBe(404);
    expect((await owner.req(`/api/jobs/${sub.json.jobId}`)).status).toBe(200);
  });

  it('counts queued jobs against the daily quota', async () => {
    await query('DELETE FROM usage_daily');
    const c = new Client(h.base);
    const statuses: number[] = [];
    for (let i = 0; i < 4; i++) statuses.push((await c.upload('/api/jobs/compress', [{ name: 'a.pdf', data: PDF }])).status);
    expect(statuses).toEqual([202, 202, 202, 402]);
  });

  it('rejects malformed job ids', async () => {
    expect((await new Client(h.base).req('/api/jobs/../../etc')).status).toBe(404);
  });
});
