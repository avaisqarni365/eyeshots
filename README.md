# EyeShots: Next-Generation PDF SaaS Platform

> **Mission:** Build a high-performance, privacy-focused, modern web and desktop PDF suite rivaling [Sejda](https://www.sejda.com/), powered by a headless **[Stirling-PDF](https://github.com/Stirling-Tools/Stirling-PDF)** processing engine and a high-speed **WebAssembly (WASM)** client-side fast path.

---

## 🏗 High-Level System Architecture

```
                                 ┌────────────────────────────────────────┐
                                 │               User Client              │
                                 │       (Browser or Desktop / Tauri)     │
                                 └───────────────────┬────────────────────┘
                                                     │
                             ┌───────────────────────┴───────────────────────┐
                             │                                               │
                             ▼                                               ▼
             ┌───────────────────────────────┐               ┌───────────────────────────────┐
             │     Client-Side WASM Path     │               │     Server-Side SaaS Route    │
             │   (Zero Server Cost / Instant)│               │  (Heavy Conversions & OCR)    │
             │   • Merge, Split, Rotate      │               │   Next.js 15 App Router       │
             │   • Delete, Reorder, Stamping │               └───────────────┬───────────────┘
             │   • pdf-lib / qpdf-wasm       │                               │
             └───────────────────────────────┘                               ▼
                                                             ┌───────────────────────────────┐
                                                             │     SaaS API Gateway & Queue  │
                                                             │   • Auth & Quota Enforcement  │
                                                             │   • Ephemeral S3 (2h Auto-Del)│
                                                             │   • Redis / BullMQ Task Queue │
                                                             └───────────────┬───────────────┘
                                                                             │
                                                                             ▼
                                                             ┌───────────────────────────────┐
                                                             │   Stirling-PDF Headless Core  │
                                                             │   • 60+ Built-in REST APIs    │
                                                             │   • LibreOffice Headless      │
                                                             │   • Tesseract / OCRmyPDF      │
                                                             │   • qpdf & Ghostscript Engine │
                                                             └───────────────────────────────┘
```

---

## 📁 Repository & Project Layout

```
D:\EyeShots\
├── core/
│   └── stirling-pdf/            # Cloned upstream Stirling-PDF engine (Java, Spring Boot, LibreOffice, OCR)
├── docs/                        # Complete technical specifications & research reports
│   ├── 01-DEEP-RESEARCH-SEJDA-ANALYSIS.md
│   ├── 02-COMPLETE-PRODUCT-AND-FEATURES-LIST.md
│   ├── 03-SYSTEM-ARCHITECTURE-BLUEPRINT.md
│   ├── 04-HEADLESS-ENGINE-AND-API-INTEGRATION.md
│   ├── 05-IN-PLACE-TEXT-EDITOR-IMPLEMENTATION.md
│   └── 06-BUSINESS-FREEMIUM-AND-LAUNCH-ROADMAP.md
├── skills/                      # AI Agent Skills & Automation Knowledge Base
│   ├── pdf-headless-orchestrator/SKILL.md
│   ├── client-side-wasm-pipeline/SKILL.md
│   ├── ephemeral-storage-janitor/SKILL.md
│   └── in-place-pdf-editor/SKILL.md
├── apps/
│   └── web/                     # User-facing Next.js 15 Web SaaS (Tailwind, Shadcn UI, PDF.js)
├── services/
│   └── api-gateway/             # SaaS API Gateway, Stripe billing, worker queue & quota manager
├── AGENTS.md                    # Core operational guidelines for AI pair programmers
└── README.md                    # Master documentation (this file)
```

---

## ⚡ Key Architectural Advantages Over Sejda

| Feature | Traditional Sejda | EyeShots (Our Architecture) |
| :--- | :--- | :--- |
| **Basic Processing (Merge, Split, Rotate)** | Uploaded to Java cloud servers | **100% Client-Side WASM (`pdf-lib`)** — 0 ms latency, \$0 bandwidth |
| **Privacy Guarantee** | Uploaded to cloud (deleted after 2h) | Client-side tasks never leave the device; Server files destroyed in 2h |
| **Backend Heavy Lifting** | Custom proprietary `SAMBox` engine | Open-source **Stirling-PDF** container (Apache PDFBox + qpdf + OCR) |
| **Desktop Client** | Heavy Electron wrapper + embedded JRE | Ultra-lightweight **Tauri 2.0 (Rust)** consuming <40 MB RAM |
| **Infrastructure Scalability** | Large monolithic Java web app | Decoupled Next.js edge frontend + stateless Docker worker clusters |

---

## 🚀 Quick Start Guide

### 1. Inspect Stirling-PDF Headless API
Navigate to the engine directory and review the built-in OpenAPI/Swagger documentation:
```bash
cd D:\EyeShots\core\stirling-pdf
# When Docker is active:
docker build -t eyeshots-core-engine -f ./Dockerfile .
docker run -p 8080:8080 eyeshots-core-engine
```
Visit `http://localhost:8080/swagger-ui/index.html` to explore the interactive API.

### 2. Review the Technical Docs
Read the comprehensive specs in the `docs/` folder:
- [01-DEEP-RESEARCH-SEJDA-ANALYSIS.md](file:///D:/EyeShots/docs/01-DEEP-RESEARCH-SEJDA-ANALYSIS.md)
- [02-COMPLETE-PRODUCT-AND-FEATURES-LIST.md](file:///D:/EyeShots/docs/02-COMPLETE-PRODUCT-AND-FEATURES-LIST.md)
- [03-SYSTEM-ARCHITECTURE-BLUEPRINT.md](file:///D:/EyeShots/docs/03-SYSTEM-ARCHITECTURE-BLUEPRINT.md)
- [04-HEADLESS-ENGINE-AND-API-INTEGRATION.md](file:///D:/EyeShots/docs/04-HEADLESS-ENGINE-AND-API-INTEGRATION.md)
- [05-IN-PLACE-TEXT-EDITOR-IMPLEMENTATION.md](file:///D:/EyeShots/docs/05-IN-PLACE-TEXT-EDITOR-IMPLEMENTATION.md)
- [06-BUSINESS-FREEMIUM-AND-LAUNCH-ROADMAP.md](file:///D:/EyeShots/docs/06-BUSINESS-FREEMIUM-AND-LAUNCH-ROADMAP.md)
- [12-ARCHITECTURE-REVIEW-AND-COMMERCIAL-READINESS.md](docs/12-ARCHITECTURE-REVIEW-AND-COMMERCIAL-READINESS.md) — current state, gaps and prioritised roadmap (start here)
- [13-ASYNC-JOB-QUEUE.md](docs/13-ASYNC-JOB-QUEUE.md) — job API, worker, retries and zero-retention guarantees
- [14-ACCOUNTS-AND-BILLING.md](docs/14-ACCOUNTS-AND-BILLING.md) — sign-in, sessions, plans and quotas, Stripe setup, GDPR
- [15-TESTING-AND-CI.md](docs/15-TESTING-AND-CI.md) — test layers, how to run them, CI pipeline

### 4. Configuration
Copy `.env.example` to `.env` and set at least `INTERNAL_STIRLING_API_KEY` (the gateway refuses to start in production with the default) and `ALLOWED_ORIGINS`.

### 3. AI Agent Skills
Consult the `skills/` folder to guide autonomous development and pair programming:
- [PDF Headless Orchestrator](file:///D:/EyeShots/skills/pdf-headless-orchestrator/SKILL.md)
- [Client-Side WASM Pipeline](file:///D:/EyeShots/skills/client-side-wasm-pipeline/SKILL.md)
- [Ephemeral Storage Janitor](file:///D:/EyeShots/skills/ephemeral-storage-janitor/SKILL.md)
- [In-Place PDF Editor](file:///D:/EyeShots/skills/in-place-pdf-editor/SKILL.md)
