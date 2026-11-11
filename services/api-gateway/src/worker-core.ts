import { Worker, UnrecoverableError, type Job } from 'bullmq';
import { config } from './config';
import { getBlobStore } from './blob-store';
import { blobKeys, createRedis, QUEUE_NAME, type JobData, type JobProgress, type JobResult } from './queue';
import { callStirling, StirlingError } from './stirling';
import { SERVER_TOOLS } from './tools';

/**
 * EyeShots queue worker
 * ---------------------
 * Pulls jobs from Redis, runs them on Stirling-PDF and stores the result in the
 * ephemeral blob store. Scale horizontally (more worker replicas) rather than
 * raising WORKER_CONCURRENCY — Stirling conversions are CPU-bound.
 *
 * Retry policy: engine timeouts / outages are retried (3 attempts, exponential
 * backoff). Inputs the engine rejects (4xx) fail immediately.
 */

const store = getBlobStore();

async function processJob(job: Job<JobData, JobResult>): Promise<JobResult> {
  const tool = SERVER_TOOLS[job.data.tool];
  if (!tool) throw new UnrecoverableError(`Unknown tool "${job.data.tool}"`);
  const progress = (p: JobProgress) => job.updateProgress(p as unknown as object);

  await progress({ stage: 'loading', percent: 5 });
  const inputs = await Promise.all(
    job.data.inputs.map(async (i) => ({ buffer: await store.getBuffer(i.key), filename: i.filename, contentType: i.contentType })),
  ).catch(() => {
    throw new UnrecoverableError('The uploaded file expired before it could be processed. Please upload it again.');
  });

  const params = tool.params.safeParse(job.data.params);
  if (!params.success) throw new UnrecoverableError('Invalid job parameters.');

  // Stirling gives no progress callbacks; advance an *estimated* percentage
  // (asymptotically towards 90%) so clients can show that work is ongoing.
  await progress({ stage: 'processing', percent: 15 });
  let estimate = 15;
  const ticker = setInterval(() => {
    estimate = Math.min(90, estimate + (90 - estimate) * 0.08);
    void progress({ stage: 'processing', percent: Math.round(estimate) }).catch(() => undefined);
  }, 2_000);

  let output;
  try {
    output = await callStirling(tool.endpoint, inputs, tool.fields(params.data));
  } catch (err) {
    if (err instanceof StirlingError) {
      console.error(JSON.stringify({ level: 'error', msg: 'engine error', jobId: job.id, tool: tool.id, kind: err.kind, status: err.status, detail: err.detail, attempt: job.attemptsMade + 1 }));
      if (err.kind === 'rejected') throw new UnrecoverableError(err.message);
      throw new Error(err.message); // retryable
    }
    throw err;
  } finally {
    clearInterval(ticker);
  }

  await progress({ stage: 'saving', percent: 95 });
  const key = blobKeys.output(job.id!);
  await store.put(key, output.buffer);

  // Inputs are no longer needed — delete them right away, don't wait for the TTL.
  await Promise.allSettled(job.data.inputs.map((i) => store.delete(i.key)));
  await progress({ stage: 'done', percent: 100 });

  // pdf-to-word may return a zip when the engine splits output; keep its extension honest.
  let filename = job.data.outputName;
  if (output.contentType.includes('zip') && !filename.endsWith('.zip')) filename = filename.replace(/\.[^.]+$/, '') + '.zip';
  return { key, filename, contentType: output.contentType, size: output.buffer.length };
}

/** Starts a queue worker. Used by the worker entrypoint and by integration tests. */
export function createWorker(opts: { concurrency?: number } = {}) {
  const connection = createRedis();
  const worker = new Worker<JobData, JobResult>(QUEUE_NAME, processJob, {
    connection,
    concurrency: opts.concurrency ?? config.WORKER_CONCURRENCY,
    // A job is considered stalled (and re-queued) if its worker stops heartbeating.
    lockDuration: 60_000,
    maxStalledCount: 1,
  });

  worker.on('completed', (job, result) => {
    console.log(JSON.stringify({ level: 'info', msg: 'job completed', jobId: job.id, tool: job.data.tool, bytesOut: result.size, ms: Date.now() - job.data.submittedAt }));
  });

  worker.on('failed', (job, err) => {
    if (!job) return;
    const final = err instanceof UnrecoverableError || err.name === 'UnrecoverableError' || job.attemptsMade >= (job.opts.attempts ?? 1);
    console.error(JSON.stringify({ level: 'error', msg: final ? 'job failed' : 'job attempt failed, will retry', jobId: job.id, tool: job.data.tool, attempt: job.attemptsMade, error: err.message }));
    // Delete inputs once no retry will happen; results never exist for failed jobs.
    if (final) void Promise.allSettled(job.data.inputs.map((i) => store.delete(i.key)));
  });

  worker.on('error', (err) => console.error(JSON.stringify({ level: 'error', msg: 'worker error', error: err.message })));

  console.log(`[EyeShots Worker] concurrency ${config.WORKER_CONCURRENCY} · store ${store.kind} · engine ${config.STIRLING_ENGINE_URL}`);
  return { worker, connection };
}
