import express, { NextFunction, Request, Response } from 'express';
import cors from 'cors';
import multer from 'multer';
import axios from 'axios';
import os from 'os';
import path from 'path';
import { config, allowedOrigins } from './config';
import { EphemeralJanitor } from './janitor';
import { baseHeaders, isPdf, rateLimit, requireBearer, safeFilename } from './security';
import { callStirling, StirlingError } from './stirling';
import { baseName, SERVER_TOOLS } from './tools';
import { createJobsRouter } from './jobs';
import { getQueue } from './queue';
import { attachUser, createAuthRouter } from './auth';
import { createAccountRouter } from './account';
import { createBillingRouter, webhookHandler } from './billing';
import { quotaConsume, quotaPrecheck } from './quotas';

/**
 * EyeShots API Gateway
 * --------------------
 * The only public entry point to the Stirling-PDF engine. Responsibilities:
 *  - CORS allow-list, rate limiting, request ids, security headers
 *  - Upload validation (size, magic bytes, parameters via Zod)
 *  - Proxying to Stirling-PDF with the internal API key (never exposed to clients)
 *  - Zero retention: sync uploads live in memory only; queued jobs (/api/jobs)
 *    are held in the ephemeral blob store and deleted within the 2-hour policy
 *  - Async job API backed by Redis/BullMQ; the worker runs as `node dist/worker.js`
 */

/**
 * Builds the Express app without side effects (no listening socket, no timers
 * started) so integration tests can mount it on an ephemeral port.
 * The runtime entrypoint is src/index.ts.
 */
export function createApp(): { app: express.Express; janitor: EphemeralJanitor } {
  const app = express();
  app.set('trust proxy', config.TRUST_PROXY_HOPS);
  app.disable('x-powered-by');

  // Uploads are kept in memory (never on disk). The janitor still sweeps any
  // temp directories that future disk-backed workers (or Stirling) may use.
  const janitor = new EphemeralJanitor([path.join(os.tmpdir(), 'eyeshots-uploads'), path.join(process.cwd(), 'temp-uploads')], 120);

  app.use(baseHeaders);
  app.use(
    cors({
      origin(origin, cb) {
        // Allow same-origin / server-to-server (no Origin header) and allow-listed browser origins.
        if (!origin || allowedOrigins.has(origin)) return cb(null, true);
        cb(null, false);
      },
      // The session cookie is sent cross-origin (web app <-> gateway), so credentials are
      // allowed — safe only because origins are an explicit allow-list.
      credentials: true,
      exposedHeaders: ['Content-Disposition', 'X-Request-Id', 'RateLimit-Remaining'],
      maxAge: 600,
    }),
  );
  // Stripe webhook needs the raw body for signature verification — register before express.json().
  app.post('/api/billing/webhook', ...webhookHandler());
  app.use(express.json({ limit: '100kb' }));
  app.use((req, res, next) => attachUser(req, res, next).catch(next));

  const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: config.MAX_UPLOAD_MB * 1024 * 1024, files: 20, fields: 20, fieldSize: 10 * 1024 },
  });

  const toolLimiter = rateLimit({ bucket: 'tools', windowMs: 60_000, max: config.RATE_LIMIT_PER_MINUTE });

  // ── Health ────────────────────────────────────────────────────────────

  /** Liveness: the process is up. */
  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', service: 'eyeshots-api-gateway', timestamp: new Date().toISOString() });
  });

  /** Readiness: the processing engine is reachable. Used by Docker/K8s probes. */
  app.get('/ready', async (_req, res) => {
    try {
      await axios.get(`${config.STIRLING_ENGINE_URL}/api/v1/info/status`, {
        timeout: 3000,
        headers: { 'X-API-KEY': config.INTERNAL_STIRLING_API_KEY },
        validateStatus: (s) => s < 500,
      });
      let queue: Record<string, unknown> | undefined;
      if (config.REDIS_URL) {
        const counts = await getQueue().getJobCounts('waiting', 'active', 'delayed', 'failed');
        queue = { enabled: true, ...counts };
      }
      res.json({ status: 'ready', queue: queue ?? { enabled: false }, janitor: janitor.getStatus() });
    } catch {
      res.status(503).json({ status: 'not-ready', detail: 'engine or queue unreachable' });
    }
  });

  app.get('/api/janitor/status', (_req, res) => res.json(janitor.getStatus()));

  // ── Synchronous tool endpoints ────────────────────────────────────────
  // Client-first rule: merge/split/rotate/etc. run in the browser. These routes
  // serve quick server tasks, API customers, and act as the fallback when the
  // job queue (REDIS_URL) is not configured. Long tasks should use /api/jobs.

  async function runSync(req: Request, res: Response, toolId: string) {
    const tool = SERVER_TOOLS[toolId];
    if (!tool) return res.status(404).json({ error: 'Unknown tool' });
    const reqId = (req as Request & { id?: string }).id;
    const files = (req.files as Express.Multer.File[]) || [];
    if (files.length < tool.minFiles) {
      return res.status(400).json({ error: tool.minFiles > 1 ? `Please upload at least ${tool.minFiles} ${tool.kind} files.` : `Please upload a ${tool.kind} file.` });
    }
    if (files.length > tool.maxFiles) return res.status(400).json({ error: `At most ${tool.maxFiles} file(s) allowed.` });
    const bad = files.find((f) => !tool.validate(f.originalname, f.buffer));
    if (bad) return res.status(415).json({ error: `"${safeFilename(bad.originalname)}" is not a valid ${tool.kind} file.` });
    const params = tool.params.safeParse(req.body ?? {});
    if (!params.success) return res.status(400).json({ error: 'Invalid parameters', fields: params.error.flatten().fieldErrors });
    if (!(await quotaConsume(req, res))) return;

    const started = Date.now();
    try {
      const out = await callStirling(
        tool.endpoint,
        files.map((f) => ({ buffer: f.buffer, filename: f.originalname, contentType: f.mimetype })),
        tool.fields(params.data),
      );
      res.setHeader('Content-Type', out.contentType);
      res.setHeader('Content-Disposition', `attachment; filename="${safeFilename(out.filename || tool.outputName(baseName(files[0].originalname)))}"`);
      res.send(out.buffer);
      console.log(JSON.stringify({ level: 'info', reqId, tool: tool.id, mode: 'sync', files: files.length, bytesIn: files.reduce((s, f) => s + f.size, 0), ms: Date.now() - started }));
    } catch (err) {
      if (!(err instanceof StirlingError)) throw err;
      // Log engine details server-side only — never echo engine internals to clients.
      console.error(JSON.stringify({ level: 'error', reqId, tool: tool.id, kind: err.kind, status: err.status, detail: err.detail, ms: Date.now() - started }));
      const status = err.kind === 'rejected' ? 422 : err.kind === 'timeout' ? 504 : err.kind === 'unavailable' ? 503 : 502;
      res.status(status).json({ error: err.message, requestId: reqId });
    }
  }

  const uploadAny = upload.array('files', 20);

  const precheck = (req: Request, res: Response, next: NextFunction) => void quotaPrecheck(req, res, next);

  app.post('/api/tools/:tool', toolLimiter, precheck, uploadAny, (req, res, next) => runSync(req, res, String(req.params.tool)).catch(next));
  // Legacy B2B paths kept for compatibility.
  app.post('/api/v1/accounting/pdf-a', toolLimiter, precheck, uploadAny, (req, res, next) => runSync(req, res, 'pdf-a').catch(next));
  app.post('/api/v1/legal/bates-numbering', toolLimiter, precheck, uploadAny, (req, res, next) => runSync(req, res, 'bates-numbering').catch(next));

  // ── Async job queue ───────────────────────────────────────────────────

  if (config.REDIS_URL) {
    app.use('/api/jobs', createJobsRouter(uploadAny, toolLimiter, precheck));
  } else {
    // Lets clients detect that the queue is off and fall back to /api/tools.
    app.use('/api/jobs', (_req, res) => res.status(503).json({ error: 'Job queue is not enabled on this server.', code: 'QUEUE_DISABLED' }));
  }

  // ── Accounts & billing ────────────────────────────────────────────────

  app.use('/api/auth', createAuthRouter());
  app.use('/api/account', createAccountRouter());
  app.use('/api/billing', createBillingRouter());

  // ── Demo-only endpoints (mock data — disabled unless ENABLE_DEMO_ENDPOINTS=true) ──
  // These return fabricated data for UI prototyping. They must never be reachable in
  // production: a fake "signature valid" response from a legal tool is dangerous.
  if (config.ENABLE_DEMO_ENDPOINTS) {
    console.warn('[gateway] DEMO endpoints enabled — responses contain mock data.');
    app.post('/api/v1/accounting/extract-invoice', upload.array('files', 1), (req, res) => {
      const files = (req.files as Express.Multer.File[]) || [];
      if (!files[0] || !isPdf(files[0].buffer)) return res.status(400).json({ error: 'Please upload a PDF file.' });
      res.json({ demo: true, fileName: safeFilename(files[0].originalname), note: 'Mock response. Real extraction runs client-side in /scan-invoice.' });
    });
    app.post('/api/v1/legal/verify-signatures', upload.array('files', 1), (req, res) => {
      const files = (req.files as Express.Multer.File[]) || [];
      if (!files[0] || !isPdf(files[0].buffer)) return res.status(400).json({ error: 'Please upload a PDF file.' });
      res.json({ demo: true, verificationStatus: 'NOT_VERIFIED', note: 'Signature validation is not implemented. Do not rely on this response.' });
    });
  }

  // ── Admin API (bearer token; disabled when ADMIN_API_TOKEN is unset) ─────

  app.get('/api/v1/admin/status', requireBearer(config.ADMIN_API_TOKEN), (_req, res) => {
    const mem = process.memoryUsage();
    res.json({
      uptimeSeconds: Math.round(process.uptime()),
      memoryRssMb: Math.round(mem.rss / 1024 / 1024),
      loadAverage: os.loadavg(),
      janitor: janitor.getStatus(),
      limits: { maxUploadMb: config.MAX_UPLOAD_MB, ratePerMinute: config.RATE_LIMIT_PER_MINUTE },
    });
  });

  // ── Errors ────────────────────────────────────────────────────────────

  app.use((_req, res) => res.status(404).json({ error: 'Not found' }));

  app.use((err: any, req: Request, res: Response, _next: NextFunction) => {
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') return res.status(413).json({ error: `File exceeds the ${config.MAX_UPLOAD_MB} MB limit.` });
      return res.status(400).json({ error: `Upload error: ${err.code}` });
    }
    console.error(JSON.stringify({ level: 'error', reqId: (req as Request & { id?: string }).id, message: err?.message }));
    res.status(500).json({ error: 'Internal error' });
  });

  return { app, janitor };
}
