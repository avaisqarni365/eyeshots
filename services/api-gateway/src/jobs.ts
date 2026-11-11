import { Router, type Request, type Response, type RequestHandler } from 'express';
import crypto from 'crypto';
import { config } from './config';
import { getBlobStore } from './blob-store';
import { blobKeys, getQueue, jobTtlMs, QUEUEABLE_TOOLS, type JobData, type JobProgress } from './queue';
import { baseName, SERVER_TOOLS } from './tools';
import { rateLimit, safeFilename } from './security';
import { getUser } from './auth';
import { quotaConsume } from './quotas';

/**
 * Async job API
 * -------------
 *   POST   /api/jobs/:tool          multipart (files + params) → 202 { jobId, statusUrl }
 *   GET    /api/jobs/:id            → { state, progress, queuePosition, result?, error?, expiresAt }
 *   GET    /api/jobs/:id/download   → the processed file
 *   DELETE /api/jobs/:id            → removes the job and all its files immediately (204)
 *
 * The job id is a random UUID and acts as a capability for anonymous jobs.
 * Jobs submitted while signed in are bound to that user (see canAccess).
 */

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Jobs submitted by a signed-in user are readable only by that user. Anonymous
 * jobs remain capability-based (whoever holds the unguessable id).
 */
function canAccess(req: Request, data: JobData): boolean {
  return !data.ownerId || data.ownerId === getUser(req)?.id;
}

function contentDisposition(filename: string) {
  const ascii = filename.replace(/[^\x20-\x7e]/g, '_').replace(/"/g, "'");
  return `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(filename)}`;
}

async function deleteJobBlobs(jobId: string, inputCount: number) {
  const store = getBlobStore();
  await Promise.allSettled([
    ...Array.from({ length: inputCount }, (_, i) => store.delete(blobKeys.input(jobId, i))),
    store.delete(blobKeys.output(jobId)),
  ]);
}

export function createJobsRouter(upload: RequestHandler, submitLimiter: RequestHandler, quotaPrecheck: RequestHandler): Router {
  const router = Router();
  const queue = getQueue();
  const store = getBlobStore();
  const pollLimiter = rateLimit({ bucket: 'job-poll', windowMs: 60_000, max: 600 });

  // Zero-retention sweeper: removes any job blob older than the TTL, even if
  // its job record was lost (e.g. Redis flushed) or the client never deleted it.
  const sweep = async () => {
    try {
      const n = await store.sweepExpired(jobTtlMs());
      if (n) console.log(JSON.stringify({ level: 'info', msg: 'job blobs swept', count: n, store: store.kind }));
    } catch (err: any) {
      console.error(JSON.stringify({ level: 'error', msg: 'job sweep failed', error: err?.message }));
    }
  };
  void sweep();
  setInterval(sweep, config.JOB_SWEEP_MINUTES * 60_000).unref();

  router.post('/:tool', submitLimiter, quotaPrecheck, upload, async (req: Request, res: Response) => {
    const tool = SERVER_TOOLS[String(req.params.tool)];
    if (!tool) return res.status(404).json({ error: 'Unknown tool' });
    if (!QUEUEABLE_TOOLS.has(tool.id)) {
      return res.status(400).json({ error: 'This tool runs synchronously.', syncUrl: `/api/tools/${tool.id}` });
    }

    const files = (req.files as Express.Multer.File[]) || [];
    if (files.length < tool.minFiles) {
      return res.status(400).json({ error: tool.minFiles > 1 ? `Please upload at least ${tool.minFiles} ${tool.kind} files.` : `Please upload a ${tool.kind} file.` });
    }
    if (files.length > tool.maxFiles) return res.status(400).json({ error: `At most ${tool.maxFiles} file(s) allowed.` });
    const bad = files.find((f) => !tool.validate(f.originalname, f.buffer));
    if (bad) return res.status(415).json({ error: `"${safeFilename(bad.originalname)}" is not a valid ${tool.kind} file.` });

    const parsed = tool.params.safeParse(req.body ?? {});
    if (!parsed.success) return res.status(400).json({ error: 'Invalid parameters', fields: parsed.error.flatten().fieldErrors });

    // Back-pressure: refuse new work instead of letting the queue grow unbounded.
    const waiting = (await queue.getWaitingCount()) + (await queue.getPrioritizedCount());
    if (waiting >= config.QUEUE_MAX_WAITING) {
      res.setHeader('Retry-After', '30');
      return res.status(503).json({ error: 'We are processing a lot of documents right now. Please try again in a moment.' });
    }

    if (!(await quotaConsume(req, res))) return;

    const jobId = crypto.randomUUID();
    const inputs = files.map((f, i) => ({
      key: blobKeys.input(jobId, i),
      filename: safeFilename(f.originalname),
      contentType: f.mimetype || 'application/octet-stream',
      size: f.size,
    }));

    try {
      await Promise.all(files.map((f, i) => store.put(inputs[i].key, f.buffer)));
      const data: JobData = {
        tool: tool.id,
        params: parsed.data as Record<string, unknown>,
        inputs,
        outputName: tool.outputName(baseName(files[0].originalname)),
        submittedAt: Date.now(),
        ownerId: getUser(req)?.id,
      };
      // Priority queue for paid plans: in BullMQ, jobs without a priority are served
      // before any prioritized job, so free/anonymous work gets a priority value.
      const paid = getUser(req)?.plan === 'pro' || getUser(req)?.plan === 'team';
      await queue.add(tool.id, data, paid ? { jobId } : { jobId, priority: 10 });
    } catch (err: any) {
      await deleteJobBlobs(jobId, inputs.length);
      console.error(JSON.stringify({ level: 'error', msg: 'job submit failed', jobId, error: err?.message }));
      return res.status(503).json({ error: 'The job queue is temporarily unavailable.' });
    }

    const statusUrl = `/api/jobs/${jobId}`;
    res.setHeader('Location', statusUrl);
    console.log(JSON.stringify({ level: 'info', msg: 'job queued', jobId, tool: tool.id, files: files.length, bytes: files.reduce((s, f) => s + f.size, 0) }));
    res.status(202).json({ jobId, statusUrl, expiresAt: new Date(Date.now() + jobTtlMs()).toISOString() });
  });

  router.get('/:id', pollLimiter, async (req, res) => {
    if (!UUID.test(String(req.params.id))) return res.status(404).json({ error: 'Job not found' });
    const job = await queue.getJob(String(req.params.id));
    if (!job || !canAccess(req, job.data)) return res.status(404).json({ error: 'Job not found or expired' });

    const state = await job.getState();
    const body: Record<string, unknown> = {
      jobId: job.id,
      tool: job.data.tool,
      state, // waiting | active | completed | failed | delayed (= waiting to retry)
      progress: (typeof job.progress === 'object' ? job.progress : { stage: 'starting', percent: 0 }) as JobProgress,
      attempts: job.attemptsMade,
      submittedAt: new Date(job.data.submittedAt).toISOString(),
      expiresAt: new Date(job.data.submittedAt + jobTtlMs()).toISOString(),
    };

    if (state === 'waiting' || state === 'prioritized') {
      // Approximate 1-based position: priority (paid) jobs first, then prioritized (free) jobs.
      if (state === 'waiting') {
        const waitingJobs = await queue.getWaiting(0, 999);
        const idx = waitingJobs.findIndex((j) => j.id === job.id);
        body.queuePosition = idx >= 0 ? idx + 1 : waitingJobs.length + 1;
      } else {
        const ahead = await queue.getWaitingCount();
        const prioritized = await queue.getPrioritized(0, 999);
        const idx = prioritized.findIndex((j) => j.id === job.id);
        body.queuePosition = ahead + (idx >= 0 ? idx + 1 : prioritized.length + 1);
      }
    }
    if (state === 'completed' && job.returnvalue) {
      body.result = {
        filename: job.returnvalue.filename,
        contentType: job.returnvalue.contentType,
        size: job.returnvalue.size,
        downloadUrl: `/api/jobs/${job.id}/download`,
      };
    }
    if (state === 'failed') body.error = job.failedReason || 'Processing failed.';
    res.json(body);
  });

  router.get('/:id/download', pollLimiter, async (req, res) => {
    if (!UUID.test(String(req.params.id))) return res.status(404).json({ error: 'Job not found' });
    const job = await queue.getJob(String(req.params.id));
    if (!job || !canAccess(req, job.data) || !(await job.isCompleted()) || !job.returnvalue) return res.status(404).json({ error: 'Result not available' });
    try {
      const { stream, size } = await store.get(job.returnvalue.key);
      res.setHeader('Content-Type', job.returnvalue.contentType);
      res.setHeader('Content-Disposition', contentDisposition(job.returnvalue.filename));
      if (size !== undefined) res.setHeader('Content-Length', String(size));
      stream.on('error', () => res.destroy());
      stream.pipe(res);
    } catch {
      res.status(410).json({ error: 'The result has expired and was deleted.' });
    }
  });

  router.delete('/:id', pollLimiter, async (req, res) => {
    if (!UUID.test(String(req.params.id))) return res.status(204).end();
    const job = await queue.getJob(String(req.params.id));
    if (!job || !canAccess(req, job.data)) return res.status(204).end();
    if (await job.isActive()) {
      // Can't interrupt a running Stirling call; the worker cleans up when it ends
      // and the sweeper is the final guarantee.
      return res.status(409).json({ error: 'The job is still running. Try again when it has finished.' });
    }
    await deleteJobBlobs(job.id!, job.data.inputs.length);
    await job.remove().catch(() => undefined);
    console.log(JSON.stringify({ level: 'info', msg: 'job deleted by client', jobId: job.id }));
    res.status(204).end();
  });

  return router;
}
