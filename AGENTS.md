# EyeShots: AI Agent Guidelines & Architecture Principles

This document sets the operational principles, coding conventions, and architectural boundaries for all AI agents and developers working in this repository.

---

## 🎯 Project Mission
EyeShots is a privacy-first, commercial-grade PDF SaaS suite rivaling Sejda. It bridges a high-speed **WebAssembly frontend** with a containerized **Stirling-PDF headless backend**.

---

## 🧭 Core Architectural Principles

### 1. The Client-First Processing Rule (Zero-Cost Principle)
Whenever a user requests a tool or action:
- **Rule:** If the task can be performed purely in the client's browser (e.g. Merge, Split, Rotate, Delete pages, Reorder, Add watermarks, Crop, Extract pages), **DO NOT send files to the server**. Execute them via `pdf-lib` or WASM.
- **Exceptions:** Only dispatch tasks to the Stirling-PDF backend when heavy server compute is strictly necessary:
  - Office conversions (`.docx`, `.xlsx`, `.pptx` requiring LibreOffice)
  - Optical Character Recognition (OCR requiring Tesseract)
  - Extreme vector compression / Ghostscript downsampling
  - Complex linearized web stream formatting (`qpdf`)

### 2. Strict Ephemeral Privacy (Zero Retention)
- No user file shall ever be stored permanently in any database, S3 bucket, or disk volume.
- Every uploaded document processed by the backend must be tagged with a **TTL (Time-To-Live)** of maximum 120 minutes (2 hours).
- The storage cleaner job (`skills/ephemeral-storage-janitor/SKILL.md`) must run periodically and wipe expired blobs and artifacts.

### 3. Decoupled Headless Engine Architecture
- **Do not modify the core Java code of `core/stirling-pdf` unless fixing a severe bug.**
- Treat Stirling-PDF as a black-box containerized REST microservice accessible over HTTP/REST.
- Wrap all calls inside `services/api-gateway` which handles validation, rate limiting, authentication, and file cleanup.

### 4. High-Fidelity UI & SEO Rule
- Every PDF tool must have its own standalone, SEO-optimized landing page (`/merge-pdf`, `/compress-pdf`, `/pdf-to-word`, etc.).
- Ensure instantaneous drag-and-drop feedback, client-side thumbnail generation using `PDF.js`, and real-time progress bars.

---

## 🛠 Tech Stack Conventions

| Layer | Technology | Primary Libraries |
| :--- | :--- | :--- |
| **Frontend** | Next.js 15 (App Router), React 19, TypeScript | Tailwind CSS, Shadcn UI, Lucide Icons, `pdf-lib`, `pdfjs-dist` |
| **Visual Canvas** | HTML5 Canvas / SVG Overlay | `fabric.js` (for annotations, shapes, signatures) |
| **API Gateway** | Node.js (Hono / Fastify) or FastAPI | Zod, BullMQ (Redis), Stripe SDK, AWS S3 Client |
| **PDF Processing Core** | Stirling-PDF (Spring Boot 3, Java 25) | Apache PDFBox, qpdf, Ghostscript, LibreOffice, OCRmyPDF |
| **Desktop Application**| Tauri 2.0 (Rust) | Native Webview + Local bundled micro-worker |

---

## ⚡ Agent Skills Reference
When working on specific domains, always read and adhere to the specialized skills:
1. `skills/pdf-headless-orchestrator/SKILL.md`: Interacting with Stirling-PDF REST APIs.
2. `skills/client-side-wasm-pipeline/SKILL.md`: Crafting browser-side `pdf-lib` routines.
3. `skills/ephemeral-storage-janitor/SKILL.md`: Enforcing 2-hour file lifecycle policies.
4. `skills/in-place-pdf-editor/SKILL.md`: Building the visual PDF editor and text replacement logic.
