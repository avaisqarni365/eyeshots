# 13 — Async Job Queue

Long server tasks (OCR, Office conversion, PDF→Word, compression, repair, PDF/A, Bates numbering) run through a **Redis + BullMQ** queue instead of holding an HTTP request open for minutes. The gateway accepts the upload and returns a job id. A separate **worker** process runs the job on Stirling-PDF, and the client polls for progress and then downloads the result.

```
Browser ──POST /api/jobs/:tool──► Gateway ──put inputs──► Blob store (tmpfs or S3)
   │                                  └─add job──► Redis (BullMQ: metadata only)
   │                                                     │
   │                                     Worker ◄────────┘  (N replicas)
   │                                       ├─ read inputs ─► Stirling-PDF ─► put output
   │                                       └─ delete inputs immediately
   ├─GET /api/jobs/:id  (state · queue position · progress)
   ├─GET /api/jobs/:id/download
   └─DELETE /api/jobs/:id   ◄── the client calls this right after downloading
```

## API

| Method | Path | Result |
|---|---|---|
| `POST` | `/api/jobs/:tool` | Multipart body: `files` plus tool params. Returns `202 { jobId, statusUrl, expiresAt }`. Errors: `400` invalid params, `415` wrong file type, `429` rate limited, `503` back-pressure or queue down (`code: QUEUE_DISABLED` when Redis isn't configured) |
| `GET` | `/api/jobs/:id` | `{ state, progress: { stage, percent }, queuePosition?, attempts, result?, error?, expiresAt }`. `state` is one of `waiting`, `active`, `delayed` (waiting to retry), `completed` or `failed` |
| `GET` | `/api/jobs/:id/download` | The processed file (RFC 5987 filename) |
| `DELETE` | `/api/jobs/:id` | Removes the job and every file it owns. Returns `204`, or `409` while the job is still running |

Queueable tools: `merge`, `compress`, `ocr`, `office-to-pdf`, `pdf-to-word`, `repair`, `pdf-a`, `bates-numbering`. All tools are defined once in `services/api-gateway/src/tools.ts`, which is shared by the sync routes and the worker.

**Protect and unlock are deliberately not queueable.** Queuing them would store the user's password in Redis job data for up to the TTL. They are fast and stay on `POST /api/tools/protect|unlock`.

The job id is an unguessable UUID that acts as a capability for reading the result. Once accounts exist, also bind jobs to the owner's user id.

## Reliability
- **Retries:** engine timeouts and outages are retried 3 times with exponential backoff (5 s, then 10 s). If Stirling rejects the input (4xx), the job fails immediately with a user-safe message (`UnrecoverableError`), and engine details are logged server-side only.
- **Crash recovery:** if a worker dies mid-job, BullMQ's lock expires after 60 s and the job is re-queued once (`maxStalledCount: 1`).
- **Graceful shutdown:** on SIGTERM the worker finishes in-flight jobs before exiting. K8s uses `terminationGracePeriodSeconds: 200`.
- **Back-pressure:** new submissions get `503 Retry-After: 30` once `QUEUE_MAX_WAITING` jobs are waiting.
- **Progress:** stages are real (`loading → processing → saving → done`). Stirling has no progress callbacks, so the percentage *within* "processing" is an estimate that advances asymptotically towards 90 %.

## Zero retention (AGENTS.md §2)
1. **Inputs** are deleted as soon as the job completes, or as soon as it fails for the last time.
2. **Results** are deleted when the client calls `DELETE` right after downloading. The web client always does this, on success or failure.
3. **The sweeper** in the gateway deletes any blob older than `JOB_TTL_MINUTES` every `JOB_SWEEP_MINUTES`. The config refuses to start unless TTL + sweep interval ≤ 120 min (defaults 110 + 5).
4. **Job metadata** in Redis is auto-removed after the same TTL (`removeOnComplete` and `removeOnFail`). Redis runs without persistence and with `noeviction`, which BullMQ requires: eviction would silently lose jobs.
5. **Storage location:**
   - Docker Compose uses a shared **tmpfs (RAM) volume**, so nothing survives a restart.
   - Multi-host deployments (K8s) use `JOB_STORE=s3` with SSE-AES256. Add a 1-day bucket lifecycle rule as a backstop; S3 lifecycle granularity is days, so the 2-hour guarantee comes from the sweeper.

## Running it

```bash
docker compose up -d --build             # redis + stirling + gateway + worker
docker compose up -d --scale worker=3    # more throughput
```

Local development without Docker for the Node parts:

```bash
npm run dev:gateway   # needs REDIS_URL=redis://localhost:6379 in .env
npm run dev:worker
```

Without `REDIS_URL` the gateway still works: `/api/jobs` answers `503 QUEUE_DISABLED`, and the web client automatically falls back to the synchronous `/api/tools` routes.

Scale workers on **queue depth** (for example with the KEDA Redis scaler on `bull:eyeshots-pdf-jobs:wait`), not on CPU. Stirling is the bottleneck, so worker replicas × `WORKER_CONCURRENCY` should match the Stirling pool's capacity.

## Verification (Nov 2026)
These were tested against a live Stirling-PDF container and Redis 7. 19 of 19 end-to-end checks passed.

**Happy path:**
- Compress, CSV→PDF (LibreOffice) and OCR with `eng+deu` all complete.
- Download names are correct.

**Failures and validation:**
- A corrupted PDF fails after 1 attempt with a user-safe message.
- A non-PDF upload gets `415`.
- Protect is refused on the queue path.
- Invalid params get `400`.

**Cleanup:**
- Inputs are deleted on completion and on final failure.
- `DELETE` removes everything, and the job then returns `404`.

**Operations:**
- With the engine unreachable, the job goes `delayed` → `delayed` → `failed` after 3 attempts.
- A gateway without Redis returns `QUEUE_DISABLED`.
- The sweeper removes only expired blobs.
- Blob keys reject path traversal.

**Browser:** Excel→PDF through the UI showed upload %, then processing, then download, and the server store was empty afterwards.

Not tested yet: the S3 store against a real bucket, and behaviour under load.
