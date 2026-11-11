# 15 — Testing & CI

Four test layers, run by one GitHub Actions pipeline.

| Layer | Tool | What it covers | Needs |
|---|---|---|---|
| **Unit (web)** | Vitest | pdf-lib pipelines (merge/split/rotate/delete/extract/watermark/numbers/repair) on real generated PDFs, invoice parser (incl. "never fabricate data" regressions), crop geometry, EXIF, WinAnsi text, accept-matching, open-redirect guard, file hand-off, tool registry integrity (every tool has a page + SEO metadata) | nothing |
| **Unit (gateway)** | Vitest | upload validation (magic bytes, Office types, filenames), rate limiter, bearer auth, tool → engine parameter mapping, plans, blob store (TTL sweep, path traversal), pricing-copy ⇄ quota consistency | nothing |
| **Integration (gateway)** | Vitest + real Express app | auth (hashed single-use codes, lockout, code invalidation, bearer, CSRF, CORS, logout-all), sync tools via a **mock Stirling engine** (parameters, error mapping, no detail leaks), quotas (anon/user/paid, atomic under concurrency), Stripe webhooks (signatures, lifecycle, idempotency, out-of-order, customer conflicts), GDPR export/delete, job queue (lifecycle, cleanup, ownership, no passwords in queue) | Postgres + Redis |
| **Browser (E2E)** | Playwright | every tool page renders with title/description, command palette, theme persistence, 404, redirects, security headers, robots/sitemap, self-hosted pdf.js; full flows for Images→PDF, PDF→Images (+ page ranges), Crop (auto + validation), wrong file type, home → tool hand-off, offline-backend error; mobile layout | production web build |
| **Live engine** | Vitest | gateway against a **real Stirling-PDF**: compress (all levels), OCR multi-language, Office→PDF, PDF→Word, AES-256 protect/unlock round-trip, Bates, corrupt-file handling | Stirling container |

Current counts: 51 web unit · 18 gateway unit · 32 integration · 17 browser · 9 live.

## Running locally

```bash
npm test                     # unit tests, no services needed (~2 s)
npm run test:integration     # needs: docker compose up -d postgres redis
npm run build:web && npm run test:e2e   # uses your installed Chrome
npm run test:live            # needs: docker compose up -d stirling-pdf-core
npm run typecheck && npm run lint
npm run test:coverage        # HTML report in coverage/
```

Integration tests use their own database (`eyeshots_test`, created automatically) and Redis DB 15, so they never touch development data. Override with `TEST_DATABASE_URL` / `TEST_REDIS_URL`. Set `TEST_VERBOSE=1` to see gateway logs.

On Windows, host port 5432 may be reserved (Hyper-V). The defaults assume Postgres on `localhost:55433` (`POSTGRES_HOST_PORT=55433`).

## CI (`.github/workflows/ci.yml`)
Runs on every push to `main` and every PR. Jobs run in parallel:

1. **checks** — `npm ci`, typecheck (web, gateway, tests), ESLint, unit tests with coverage artefact.
2. **integration** — Postgres 16 + Redis 7 service containers, mock engine.
3. **e2e** — production build + Playwright (Chromium); report + traces uploaded on failure.
4. **docker** — builds the gateway image, verifies it ships migrations and both entrypoints and runs as non-root, and fails on **critical** vulnerabilities (Trivy, unfixed ignored).

`engine-smoke.yml` runs the live-engine suite **nightly**, on demand, and on PRs that touch engine wiring (`tools.ts`, `stirling.ts`). It catches Stirling API drift the mock can't. Dependabot opens weekly update PRs for npm, Actions and the Docker base image.

**Lint ratchet:** older pages carry 294 ESLint warnings (mostly unused imports and `any`). `npm run lint` fails if that number grows, so it can only go down. Lower `--max-warnings` in `apps/web/package.json` as you clean up.

## Bugs these tests found (fixed)
- **Invoice scanner invented amounts:** with no totals in the document it filled in €1,000 net / €190 VAT / €1,190 gross plus today's date, which would have been booked via DATEV/ZUGFeRD. Missing values now stay empty, and exports are **blocked** until the required fields are filled in.
- **PDF → Images page ranges were off by one:** asking for page 2 exported page 1.
- **Older sign-in codes stayed valid** after a newer one was issued or used. Now only the newest code is valid, and a successful sign-in burns all outstanding codes.
- **Webhook crash loop:** a Stripe customer id already linked to another user hit a unique constraint, returned 500, and Stripe would retry forever. It's now handled safely.
- **Security:** `next@15.1.7` was affected by CVE-2025-66478 (critical RSC vulnerability) plus later advisories. The lockfile now pins **Next.js 15.5.29**, along with patched `sharp`, `postcss` and `tar`.

## Known remaining advisories (need major upgrades)
| Package | Issue | Exposure | Action |
|---|---|---|---|
| `fabric` 5 → 7 | XSS via SVG export | Editor; we export raster/PDF, not SVG | Plan the upgrade (API changes in v6+) |
| `tar` (critical) via `fabric → canvas → node-pre-gyp` | Path traversal when extracting archives | Optional native build dependency only; never shipped to browsers or the gateway image | Removed by the `fabric` 7 upgrade |
| `next` (moderate, bundled `postcss`) | CSS stringify XSS | Build tooling | Fixed in Next 16 |
| `nodemailer` 7 → 10 | SMTP injection via `envelope.size` | We never set `envelope` | Upgrade in a separate PR |
| `zod` 3 → 4 | Memory exhaustion on huge constrained collections | Request bodies are capped at 100 KB | Upgrade in a separate PR |
