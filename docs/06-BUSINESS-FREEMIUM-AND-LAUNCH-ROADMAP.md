# Business Model, Pricing Tiers, & Go-To-Market Roadmap

This document outlines the commercialization strategy, freemium tier rules, Stripe billing architecture, and SEO growth mechanics for the EyeShots platform.

---

## 1. Monetization & Tier Comparison

To outcompete Sejda, EyeShots leverages its **Client-Side WASM engine** to offer more generous free limits on standard tools, while gating resource-heavy server compute (OCR, Office conversions, large file sizes) behind affordable paid tiers.

| Tier | Price | Processing Limits | Storage & Quota | Target Customer |
| :--- | :--- | :--- | :--- | :--- |
| **Free Tier** | **$0** | • **Unlimited** Client-side WASM tasks (Merge, Split, Rotate, Delete)<br>• **3 Heavy Server Tasks / hour** (OCR, Word conversion)<br>• Max 100 MB or 150 pages per file | 2-Hour Auto-Delete Lifecycle | Casual users, students, personal tasks |
| **Web Pro** | **$7 / mo** or **$59 / yr** | • **Unlimited** heavy server tasks<br>• Batch processing (up to 50 files simultaneously)<br>• Files up to 2 GB or 2,000 pages<br>• Priority queue (zero queue wait time) | 2-Hour Auto-Delete Lifecycle + Priority bandwidth | Freelancers, small businesses, accountants |
| **Desktop Lifetime** | **$69 one-time** | • **100% Offline processing** via Tauri desktop app<br>• Unlimited file sizes & pages<br>• No subscription, lifetime updates | Zero cloud data egress | Enterprise, healthcare, legal counsel |
| **Developer API** | **$0.005 / task** | • Headless REST API access<br>• Webhook integration and high-concurrency rate limits | Ephemeral storage | B2B SaaS integrations, document automation |

---

## 2. Programmatic SEO Strategy (The Secret to Sejda's Traffic)

Over 90% of Sejda's 20M+ monthly visits originate from organic search. EyeShots will deploy a programmatic SEO directory targeting long-tail document manipulation keywords:

```
Domain Structure:
eyeshots.com/
├── merge-pdf
├── split-pdf
├── compress-pdf
├── pdf-to-word
├── word-to-pdf
├── ocr-pdf
├── protect-pdf
├── sign-pdf
└── /alternatives/
    ├── sejda-alternative
    ├── ilovepdf-alternative
    └── smallpdf-alternative
```

Each page features:
1. **Interactive Drag-and-Drop Zone:** Positioned above the fold with zero initial sign-up barriers.
2. **Instant WASM Execution:** Basic tasks complete immediately inside the browser.
3. **Keyword-Rich Educational Content:** FAQs, step-by-step instructions, and schema.org `HowTo` markup below the tool zone to capture Google rich snippets.

---

## 3. Four-Phase Launch Roadmap

```
Phase 1: Foundation & Stirling Engine (Weeks 1–3)
├── Setup containerized Stirling-PDF headless core on Hetzner / AWS
├── Build Next.js 15 UI with PDF.js preview canvas
├── Deploy Client-Side WASM engine for Merge, Split, Rotate, Delete
└── Launch free public beta for top 5 tools

Phase 2: Full Tool Parity & Stripe Billing (Weeks 4–6)
├── Wire up all 35+ Stirling-PDF REST endpoints in services/api-gateway
├── Implement Redis BullMQ priority queue and worker retry logic
├── Integrate Stripe Checkout, Customer Portal, and Webhooks
└── Add automated 2-hour ephemeral S3 file cleanup janitor

Phase 3: Visual PDF Editor & Signatures (Weeks 7–10)
├── Launch Fabric.js annotation canvas over PDF.js
├── Add Add Text, Freehand Signature, Whiteout, Shapes, and Image insertion
├── Implement AcroForm form filling and flattening engine
└── Begin marketing campaign targeting legal and accounting forums

Phase 4: Tauri Desktop App & Developer API (Weeks 11–14)
├── Package cross-platform desktop application using Tauri 2.0 (Rust)
├── Implement offline licensing key verification
├── Launch public Developer REST API with documentation & developer portal
└── Scale containerized worker swarm behind cloud load balancers
```
