# Complete Product & Features Specification

This specification catalogs all 35+ PDF tools required to match and exceed Sejda's product capabilities, categorized by functional domain with technical execution paths (Client-Side WASM vs. Server-Side Stirling-PDF).

---

## 1. Feature Matrix & Execution Paths

```
Processing Strategy Key:
[WASM]   = Executed 100% in browser via pdf-lib / WebAssembly (Zero latency, $0 server cost)
[SERVER] = Routed to Stirling-PDF Headless REST API (Requires LibreOffice, OCR, or Ghostscript)
```

| ID | Tool Name | Slug | Path | Input Formats | Output Format | Description |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **01** | **PDF Editor** | `/edit-pdf` | [HYBRID] | `.pdf` | `.pdf` | Direct text editing, adding text, images, shapes, signatures, and annotations. |
| **02** | **Merge PDF** | `/merge-pdf` | [WASM] | `.pdf`, images | `.pdf` | Concatenates multiple files; supports reordering, cover page, and TOC. |
| **03** | **Split PDF** | `/split-pdf` | [WASM] | `.pdf` | `.zip` (PDFs) | Splits by page count, ranges, bookmarks, or file size. |
| **04** | **Split in Half** | `/split-in-half` | [WASM] | `.pdf` | `.pdf` | Slices two-page book scans down the middle into two individual vertical pages. |
| **05** | **Alternate & Mix** | `/alternate-mix` | [WASM] | 2x `.pdf` | `.pdf` | Interleaves odd- and even-page scan batches into a single coherent document. |
| **06** | **Compress PDF** | `/compress-pdf` | [SERVER] | `.pdf` | `.pdf` | Downsamples embedded images, strips font bloat, and deflates streams. |
| **07** | **Delete Pages** | `/delete-pages` | [WASM] | `.pdf` | `.pdf` | Visual page selector allowing one-click removal of unneeded pages. |
| **08** | **Rotate PDF** | `/rotate-pdf` | [WASM] | `.pdf` | `.pdf` | Updates page rotation flags (`/Rotate 90/180/270`) without re-encoding page content. |
| **09** | **Crop PDF** | `/crop-pdf` | [WASM] | `.pdf` | `.pdf` | Visual bounding box selection to adjust page `MediaBox` and `CropBox`. |
| **10** | **PDF to Word** | `/pdf-to-word` | [SERVER] | `.pdf` | `.docx` | Structural layout analysis converting PDF geometry to editable Microsoft Word. |
| **11** | **Word to PDF** | `/word-to-pdf` | [SERVER] | `.docx`, `.doc`, `.odt` | `.pdf` | Headless LibreOffice conversion maintaining fonts, styles, and tables. |
| **12** | **PDF to Excel** | `/pdf-to-excel` | [SERVER] | `.pdf` | `.xlsx` | Extracts tabular data and table boundaries into formatted spreadsheets. |
| **13** | **Excel to PDF** | `/excel-to-pdf` | [SERVER] | `.xlsx`, `.xls` | `.pdf` | Renders spreadsheets to vector PDF pages with page-break controls. |
| **14** | **PDF to PPTX** | `/pdf-to-powerpoint` | [SERVER] | `.pdf` | `.pptx` | Converts presentation slide PDFs into editable PowerPoint decks. |
| **15** | **PPTX to PDF** | `/powerpoint-to-pdf` | [SERVER] | `.pptx`, `.ppt` | `.pdf` | Converts presentation files into clean vector PDF slides. |
| **16** | **PDF to JPG/PNG**| `/pdf-to-images` | [WASM] | `.pdf` | `.zip` (images)| High-resolution rasterization of individual pages via PDF.js Canvas. |
| **17** | **JPG/PNG to PDF**| `/images-to-pdf` | [WASM] | `.jpg`, `.png`, `.webp`| `.pdf` | Assembles image collections into a uniform PDF with margin controls. |
| **18** | **HTML to PDF** | `/html-to-pdf` | [SERVER] | URL or `.html` | `.pdf` | High-fidelity rendering via headless Chromium with modern CSS support. |
| **19** | **OCR PDF** | `/ocr-pdf` | [SERVER] | Scanned `.pdf` | `.pdf` | Tesseract/OCRmyPDF pipeline creating an invisible searchable text overlay. |
| **20** | **Protect PDF** | `/protect-pdf` | [WASM] | `.pdf` | `.pdf` | Encrypts document with user/owner passwords and AES permissions. |
| **21** | **Unlock PDF** | `/unlock-pdf` | [WASM] | `.pdf` | `.pdf` | Strips password restrictions and bitmasks when authorization is provided. |
| **22** | **Page Numbers** | `/add-page-numbers`| [WASM] | `.pdf` | `.pdf` | Injects dynamic numbering (`Page X of Y`) with margin and font controls. |
| **23** | **Bates Numbering**| `/bates-numbering` | [WASM] | `.pdf` | `.pdf` | Legal indexing with prefixes, suffixes, and zero-padded counters. |
| **24** | **Header & Footer**| `/header-footer` | [WASM] | `.pdf` | `.pdf` | Adds customizable text, copyright notices, and timestamps to margins. |
| **25** | **Watermark** | `/watermark-pdf` | [WASM] | `.pdf`, image | `.pdf` | Applies semi-transparent diagonal text or company logo stamps. |
| **26** | **Flatten PDF** | `/flatten-pdf` | [WASM] | `.pdf` | `.pdf` | Converts interactive AcroForm fields and annotations into static content streams. |
| **27** | **Fill & Sign** | `/fill-and-sign` | [HYBRID] | `.pdf` | `.pdf` | Interactive form filling, checkboxes, and vector/drawn signatures. |
| **28** | **Grayscale PDF** | `/grayscale-pdf` | [SERVER] | `.pdf` | `.pdf` | Transforms color spaces (`DeviceRGB` to `DeviceGray`) to save printer ink. |
| **29** | **Deskew PDF** | `/deskew-pdf` | [SERVER] | `.pdf` | `.pdf` | Automatically straightens crooked pages from physical scanners. |
| **30** | **Extract Pages** | `/extract-pages` | [WASM] | `.pdf` | `.pdf` | Extracts selected page numbers into a standalone output PDF. |
| **31** | **N-Up / Imposition**| `/n-up-pdf` | [WASM] | `.pdf` | `.pdf` | Arranges multiple logical pages (2-up, 4-up) onto a single physical sheet. |
| **32** | **Edit Metadata** | `/edit-metadata` | [WASM] | `.pdf` | `.pdf` | Modifies Info Dictionaries & XMP metadata (Author, Title, Keywords). |
| **33** | **Extract Images** | `/extract-images` | [SERVER] | `.pdf` | `.zip` (images)| Extracts raw `/XObject` `/Subtype /Image` streams without recompression. |
| **34** | **PDF to Text** | `/pdf-to-text` | [WASM] | `.pdf` | `.txt` | Fast textual extraction without layout styling. |
| **35** | **Repair PDF** | `/repair-pdf` | [SERVER] | Corrupted `.pdf` | `.pdf` | Rebuilds damaged cross-reference tables (`xref`) and broken object streams. |

---

## 2. Technical Complexity & Implementation Tiers

```
┌────────────────────────────────────────────────────────────────────────┐
│ TIER 1: CLIENT-SIDE WASM (Week 1–2)                                    │
│ • Zero server overhead; immediate user gratification                  │
│ • Merge, Split, Rotate, Delete, Page Numbers, Watermark, Passwords     │
├────────────────────────────────────────────────────────────────────────┤
│ TIER 2: STIRLING-PDF REST PROXY (Week 3–4)                             │
│ • Relayed to containerized microservices                               │
│ • Office conversions (LibreOffice), OCR, Compress, Grayscale, Deskew   │
├────────────────────────────────────────────────────────────────────────┤
│ TIER 3: INTERACTIVE CANVAS & TEXT EDITOR (Week 5–8)                    │
│ • Custom PDF.js + Fabric.js visual editing layer                       │
│ • Signatures, form filling, annotations, and in-place text replacement │
└────────────────────────────────────────────────────────────────────────┘
```
