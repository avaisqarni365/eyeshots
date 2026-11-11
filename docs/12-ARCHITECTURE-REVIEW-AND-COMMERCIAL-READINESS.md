# 12 — Architecture Review & Commercial Readiness (Nov 2026)

A full review of the EyeShots monorepo: what exists, what is real versus simulated, what was fixed in this pass, and what is still missing before EyeShots can be sold as a commercial product.

---

## 1. Verdict

**The core architecture is sound, but it's only half built.** The client-first split (pdf-lib and pdf.js in the browser, Stirling-PDF behind a gateway) is the right design for a privacy-first Sejda competitor. It keeps the cost per task near zero and gives a privacy story competitors can't match.

The rest of the platform around it isn't built yet. The planning docs (01–11) describe a SaaS with auth, billing, quotas, queues, S3 and a cluster. Today the code has:

- ~~No user accounts, auth, billing or quotas.~~ Now built: see [14-ACCOUNTS-AND-BILLING.md](14-ACCOUNTS-AND-BILLING.md). The async job queue is in [13-ASYNC-JOB-QUEUE.md](13-ASYNC-JOB-QUEUE.md).
- **Several features that only simulate their behaviour:** the DMS, Acrobat Studio, the admin dashboard, the translation engine and parts of the gateway. Some of them showed fabricated results to users (see §3).

Rough readiness:

| Layer | State | Readiness |
|---|---|---|
| Client-side PDF tools (merge, split, rotate, delete, crop, watermark, numbers, images↔PDF) | Real, working | 🟢 Production-capable |
| Server tools via gateway (compress, OCR, Office↔PDF, protect, unlock, repair) | Real proxy to Stirling | 🟡 Works; needs a queue and quotas to scale |
| Editor / Fill & Sign | Real; whiteout is cosmetic only | 🟡 |
| Compare, Invoice scanner | Real, with fixes from this pass | 🟡 |
| Translate (PDF Space), DMS, Acrobat Studio, Forms "official" | Largely mock or demo | 🔴 Label as beta or finish |
| Accounts, billing, quotas, API keys | Missing | 🔴 |
| Observability, CI/CD, tests | Missing | 🔴 |
| Desktop (Tauri) | Shell only; static export now possible | 🟡 |

---

## 2. What changed in this pass

### Design system & UX
- **One brand system.** Before, the UI mixed emerald and indigo; it now uses a single emerald `brand` palette in Tailwind, new tokens in `globals.css`, a system Inter font stack, a grid background and gradient accents, `prefers-reduced-motion` support and focus-visible rings.
- **Dark mode** that actually works: a `ThemeToggle` with light/dark/system and no flash on load (an inline init script). Before, `darkMode: 'class'` was configured but nothing could switch it.
- **Single tool registry** (`lib/tools-data.ts`) now drives the navbar mega-menu, the mobile drawer, the home grid, the footer, the command palette, `sitemap.xml`, per-route SEO metadata and related-tools sections. Before, the navbar alone was 847 lines of hand-coded links.
- **Command palette** opens with ⌘/Ctrl + K or `/` and supports fuzzy search over 28 tools.
- **New home page** with a hero, a universal dropzone that accepts PDF, Office and image files and suggests matching tools, category tabs, a privacy section, an FAQ (with FAQPage JSON-LD) and a CTA.
- **Shared UI kit:** `ToolPageShell` (breadcrumb, header, privacy badge, how-to, FAQ with JSON-LD, related tools) plus `ToolCard`, `ToolIcon`, `Button`, `Panel`, `Alert`, `Progress`, `Segmented`, `Field`, `FileChip` and `FaqList`.
- **`FileDropzone` fixes:** it now honours `accept` (before, it rejected every non-PDF, which broke Office and image inputs), enforces size limits and is keyboard-accessible.
- **File hand-off fixed.** A file dropped on the home page used to be lost on navigation; only its name went to localStorage. Files now pass through an in-memory store (`lib/file-handoff.ts`), consumed by `FileDropzone` or by `HandoffInjector` for legacy pages. File bytes are never persisted.

### New features
| Route | Type | Notes |
|---|---|---|
| `/crop-pdf` | Client | Auto-trim (detects content per page, rotation-aware) or manual margins with a live preview |
| `/jpg-to-pdf` | Client | JPG/PNG/WebP/GIF/BMP, drag to reorder, A4/Letter/fit, orientation, margins, EXIF rotation, lossless JPEG pass-through |
| `/pdf-to-jpg` | Client | JPG/PNG at 72, 150 or 300 DPI, page ranges, ZIP output, cancellable |
| `/word-to-pdf`, `/excel-to-pdf`, `/powerpoint-to-pdf` | Server | Shared `OfficeToPdfTool`; the gateway validates file magic bytes |
| `/pricing` | — | Monthly/yearly toggle; plans live in `lib/plans.ts` |
| `/privacy`, `/terms`, `/imprint` | — | **Templates.** An Impressum is legally required for the German market |
| `sitemap.xml`, `robots.txt`, 404 page | — | SEO basics |
| Per-tool `<title>` and description | — | Every tool route has a `layout.tsx` with metadata from the registry. This was required by AGENTS.md §4 but missing |

The four routes that previously 404'd from the menu (crop, word, excel, powerpoint) now exist.

### Gateway hardening (`services/api-gateway`)
- **Config:** Zod-validated env config (`config.ts`). The gateway **refuses to start in production** with the default Stirling API key or with demo endpoints enabled.
- **CORS:** an allow-list (`ALLOWED_ORIGINS`) replaces `cors()` with any origin.
- **Rate limiting** per IP, with `RateLimit-*` and `Retry-After` headers.
- **Upload validation:**
  - Magic-byte checks for PDF and Office files.
  - Filename sanitising.
  - Multer limits on file count, field count and field size.
  - A 413 response for oversize files.
  - Zod validation on every parameter.
- **Error handling:** errors no longer leak engine internals to clients. They return a request id and log structured JSON.
- **Compression levels fixed.** The UI sent `1–3`, but Stirling's `optimizeLevel` runs 1–9 (default 5), so "Extreme" was actually light compression. The levels are now mapped to 3, 5 and 8.
- **OCR:** multi-language support (`eng+deu`) and `ocrType=skip-text`, so PDFs that already contain text no longer fail.
- **Bates numbering:** the start number was ignored; it now uses `startingNumber`, `zeroPad` and the correct position.
- **Fake endpoints removed from the default build.** The fake "signature VALID_AND_UNMODIFIED" response, the fake invoice extraction and the fake MRR/admin stats now sit behind `ENABLE_DEMO_ENDPOINTS` and return `demo: true`.
- **Admin API** requires a bearer token and is disabled when no token is set.
- **Operations:** `/ready` probe, graceful shutdown, `Cache-Control: no-store`.
- **Docker:** the image runs as a non-root user with a `HEALTHCHECK`. Compose binds Stirling and Redis to localhost only, puts engine `/tmp` on tmpfs (supports zero retention) and runs Redis without persistence.

### Bugs and integrity issues fixed
1. **Detached-ArrayBuffer crash.** pdf.js transfers the buffer it receives to its worker, which detaches it. Invoice Scanner failed on every real upload, OCR analysis failed on first run, and Compare field sync broke. All 30 `getDocument` call sites now pass a copy.
2. **Fabricated financial data.** The invoice scanner filled missing fields with a hard-coded vendor, IBAN, VAT ID and tax number, plus random invoice and customer numbers, and these values were exported to DATEV and ZUGFeRD. Missing fields now stay empty, and the confidence score is calculated instead of a constant 98.
3. **Fake cryptography.** Generated forms printed a random "eIDAS-Hash SHA256-…", and sample comparison PDFs printed a fake document hash. Both are removed.
4. **Fake encryption.** Acrobat Studio's "Apply 256-bit AES" button only showed a toast and ignored the password. It now routes to the real Protect PDF tool.
5. **Fabricated repair report.** Server-mode repair reported a fixed "1 page recovered" and a canned list of fixes. It now counts the real pages, and the fake progress delays are gone.
6. **Markdown → PDF** cut every paragraph at 85 characters. It now word-wraps properly with page breaks and WinAnsi-safe text (`lib/pdf/text-utils.ts`).
7. **Bilingual translation export** always crashed: the "⟷" glyph can't be encoded by Helvetica.
8. **CDN privacy leak.** pdf.js CMaps were loaded from jsdelivr. They are now self-hosted in `/public/pdfjs`, which also makes them work offline in the desktop app.
9. **Third-party translation call** (MyMemory) would have sent document text off-site. It is now disabled unless explicitly enabled.
10. **`/admin` had no auth.** It now has Basic-auth middleware and returns 404 in production when not configured. It is also removed from the public navigation and set to `noindex`.
11. **Editor whiteout** is now labelled as **not** a secure redaction; the original text stays extractable.
12. **`/german-forms`** duplicated `/forms`. It now 301-redirects to `/forms`.
13. **Cluster compose:** fixed the wrong env var names (`STIRLING_PDF_URL`, `NEXT_PUBLIC_API_URL`) and removed the hard-coded JWT secret.

---

## 3. How it fits the architecture (AGENTS.md compliance)

| Principle | Before | Now | Remaining |
|---|---|---|---|
| §1 Client-first processing | Mostly followed | Crop, images↔PDF and PDF→images added client-side | Watermark, page numbers and Bates could all run client-side for API users too |
| §2 Zero retention (≤ 2 h TTL) | Janitor swept dirs that were never used (uploads are in memory), and the Stirling container's own temp dir was not covered | Engine `/tmp` is now tmpfs; Redis has no persistence; responses are `no-store` | Done for queued jobs: inputs deleted on completion, results deleted on download, a sweeper enforces TTL + interval ≤ 120 min, and Redis job metadata expires on the same TTL. Still to add: a nightly retention self-audit |
| §3 Stirling as black box behind the gateway | Followed, but the dev API key was hard-coded and CORS was open | Secrets come from env, startup refuses the defaults, CORS is allow-listed | Stirling in the cluster compose has `DOCKER_ENABLE_SECURITY=false`. Enable it and set `API_KEY`. Pin the image version (not `:latest`) |
| §4 SEO landing page per tool | Every page was `'use client'` with no metadata | Per-route metadata, sitemap, canonical URLs, FAQ JSON-LD | Long-form SEO copy per tool; locale variants (`/de/pdf-zusammenfuegen`) for the DACH market |

---

## 4. What's still missing (ranked)

### P0 — required before charging money
1. ~~**Identity & accounts**~~ ✅ **Done.** See [14-ACCOUNTS-AND-BILLING.md](14-ACCOUNTS-AND-BILLING.md). Still open: team seats and SSO for Business.
2. ~~**Billing**~~ ✅ **Done.** See [14-ACCOUNTS-AND-BILLING.md](14-ACCOUNTS-AND-BILLING.md). Still open: switching the pricing CTAs to live mode once Stripe keys and prices are configured.
3. ~~**Quotas and plan enforcement**~~ ✅ **Done.** See [14-ACCOUNTS-AND-BILLING.md](14-ACCOUNTS-AND-BILLING.md). Still open: raising MAX_UPLOAD_MB (with streamed uploads) so Pro really gets 1 GB.
4. ~~**Async job pipeline.**~~ ✅ **Done.** Redis/BullMQ queue, a separate worker, a blob store (tmpfs or S3), retries, back-pressure, progress, and fallback to sync. See [13-ASYNC-JOB-QUEUE.md](13-ASYNC-JOB-QUEUE.md).
5. **Distributed rate limiting.** The in-memory limiter is per-process; move it to Redis once there is more than one replica.
6. **Legal.** Fill in the Imprint and Privacy templates, add a DPA for Business, add a cookie and consent decision (currently no tracking, so none is needed), and document data residency (EU hosting).
7. **Honest feature labelling.** The DMS (files are discarded on upload, data is lost on reload), Acrobat Studio (export drops the original PDF, the AI panels return canned text), PDF Space translation (glossary stub) and "official" forms (generated look-alikes) should be marked **Beta/Preview** or hidden until they are real.

### P1 — quality & operations
8. ~~**Tests and CI.**~~ ✅ **Done.** Unit, integration, browser and live-engine suites plus a GitHub Actions pipeline. See [15-TESTING-AND-CI.md](15-TESTING-AND-CI.md).
9. **Observability.** OpenTelemetry traces for gateway → Stirling, Prometheus metrics (latency, queue depth, error rate per tool), and Sentry on web and gateway with PII scrubbing. Log file names only behind a flag.
10. **pdf.js resource hygiene.** No page ever calls `PDFDocumentProxy.destroy()`. Thumbnail loops can't be cancelled, and render tasks aren't cancelled on zoom or page change in the viewer, editor and compare tools. This causes memory growth and "multiple render()" errors on large files. The new tools (crop, PDF→images) do this correctly; port the pattern (`lib/pdf/pdfjs-setup.ts`).
11. **Web Workers for heavy client tasks.** pdf-lib runs on the main thread, so merging 500 pages freezes the UI. Move `wasm-pipeline` into a worker (Comlink).
12. **Unicode text output.** Standard fonts are WinAnsi-only. Embed Noto Sans via `@pdf-lib/fontkit` for watermark, page-number and markdown text in other scripts (Cyrillic, Arabic, CJK).
13. **Real redaction.** Whiteout covers content without removing it. Offer true redaction via Stirling `/api/v1/security/auto-redact` (server) or rasterise-and-replace (client).
14. **Gradual migration of legacy pages to `ToolPageShell`.** Twenty legacy pages still carry their own headers, breadcrumbs and drag-drop code. Migrate the high-traffic ones first: merge, split, compress, edit.
15. **Missing deployment artefacts:** `apps/web/Dockerfile` (use `output: 'standalone'`), `deploy/nginx/nginx.conf`, K8s secrets, HPA and PodDisruptionBudgets, and pinned image tags.

### P2 — growth
16. **Internationalisation.** DE is the obvious second locale given the DATEV, ZUGFeRD and Jobcenter features. Use `next-intl` with localised slugs.
17. **Batch processing and a public API** for Pro and Business, including API keys, usage metering and OpenAPI docs.
18. **Desktop app.** Set a strict CSP in `tauri.conf.json` (currently `null`), wire `TAURI_BUILD=1 next build` into `apps/desktop` (static export is now supported), add auto-update and code signing, and optionally bundle a local Stirling sidecar for fully offline Office conversion and OCR.
19. **PWA and offline support** for the web client-side tools (service worker caching `/pdfjs/*` and app chunks).
20. **Client-side OCR fallback** (tesseract.js) for small documents. This keeps OCR on-device, which is the strongest privacy differentiator.

---

## 5. Target architecture

```
Browser / Tauri ──► Next.js (static + SSR SEO pages, CDN-cached)
   │  client tools: pdf-lib / pdf.js in Web Workers (no upload)
   │
   └─► API Gateway (stateless, N replicas)
         ├─ AuthN (JWT) · plan/quota check (Redis) · rate limit (Redis)
         ├─ sync fast path  (< 10 s tasks, small files)
         └─ POST /jobs ──► Redis/BullMQ ──► Workers ──► Stirling-PDF pool (private network)
                                              └─► S3 (SSE, 2 h lifecycle) ──► signed URL to client
Stripe ⇄ webhook ► gateway ► Postgres (users, orgs, plans, usage — never documents)
Observability: OTel → Tempo/Jaeger · Prometheus/Grafana · Sentry (PII-scrubbed)
```

The principle that keeps it commercially strong is that **documents never touch Postgres**: only metadata and usage counters are stored. Every byte of a document lives in browser memory or in TTL-bound storage.

---

## 6. Verification performed
- `tsc --noEmit` passes for `apps/web` and `services/api-gateway`; `next build` succeeds (40 routes).
- Browser-tested on the production build:
  - Home page in light, dark and mobile at 375 px, with no horizontal overflow.
  - The command palette.
  - Mega-menu and mobile drawer.
  - Pricing.
  - Images→PDF end to end: the output is a valid `%PDF-1.7` file.
  - PDF→Images end to end: a ZIP with one image per page.
  - Crop auto-trim: the cropped output was re-rendered and confirmed.
  - Home → tool file hand-off into a legacy page (Split).
- **Correction:** this section originally said Stirling wasn't available. Docker was in fact running, and the server tools have since been tested against the live engine through the job queue (see doc 13).
