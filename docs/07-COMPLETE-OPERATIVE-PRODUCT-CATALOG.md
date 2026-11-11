# EyeShots: Complete Operative Product & Tools Catalog
**Reference Baseline:** Sejda PDF Suite (Commercial Benchmark)  
**Execution Standard:** Client-First Zero-Cost Architecture + Stirling-PDF Headless Microservice Engine  
**Privacy Standard:** 100% Strict Ephemeral Privacy (Zero Long-Term Retention, 120-Minute In-Memory TTL)

---

## 🧭 Executive Architecture Strategy

Every tool in the EyeShots platform adheres to the **Client-First Zero-Cost Rule**:
1. **[WASM / CLIENT] (Zero Server Cost, Instant 0ms Latency)**:  
   Tasks involving PDF structure manipulation, rotation, page extraction, splitting, watermarking, encryption/decryption, Bates numbering, page numbering, crop, in-place text replacement, e-signatures, whiteout, and visual scan enhancement execute **100% inside the user's browser** via `pdf-lib`, `PDF.js`, and HTML5 Canvas.
2. **[SERVER / STIRLING] (Heavy Compute Headless Engine)**:  
   Dispatched to the containerized Stirling-PDF microservice (Spring Boot 3 / Apache PDFBox / LibreOffice / Tesseract 5 / Ghostscript / QPDF) only when complex conversions, OCR, extreme raster downsampling, or deep vector deskewing are strictly necessary.
3. **[HYBRID]**: Interactive visual editing in-browser with optional high-resolution headless flattening.

---

## 🗂️ Complete Operative Tools Catalog (10 Functional Domains)

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                                 TOP ACTION BAR TOOLS                                   │
│  All Tools ▾ │ Compress │ Edit │ Fill & Sign │ Delete Pages │ Merge │ Split │ Viewer    │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

---

### Category 1: POPULAR (Quick-Access Core Suite)

| Tool Name | Sejda Dot | Execution Path | Route Path | Description & Functional Specification | Current Status |
| :--- | :---: | :--- | :--- | :--- | :--- |
| **Edit** | • | `[HYBRID]` | `/edit-pdf` | Edit PDF files for free. Fill & sign PDF. Add text, links, images and shapes. Edit existing PDF text in-place. Annotate PDF with whiteout, highlighter, and freehand ink. | **OPERATIONAL** |
| **Compress** | • | `[SERVER]` | `/compress-pdf` | Reduce the size of your PDF using Ghostscript vector optimization and JBIG2 image downsampling with preset levels (Extreme, Recommended, Low). | **OPERATIONAL** |
| **Fill & Sign** | • | `[HYBRID]` | `/fill-and-sign` | Add signature to PDF. Fill out PDF forms, check checkboxes, insert date stamps, and type cursive e-signatures. | **OPERATIONAL** |
| **PDF to Word** | • | `[SERVER]` | `/pdf-to-word` | Convert from PDF to editable Microsoft Word (`.docx`) preserving font metrics, paragraph structures, and tables via headless LibreOffice. | **OPERATIONAL** |
| **PDF to Text** | • | `[WASM]` | `/pdf-to-text` | Copies all text from the PDF document and extracts it to a clean `.txt` file with 0ms server latency. | **IMPLEMENTED** |
| **Split by pages** | • | `[WASM]` | `/split-pdf` | Split specific page ranges or extract every page into a separate document with instant zip bundling. | **OPERATIONAL** |
| **OCR** | • | `[SERVER]` | `/ocr-pdf` | Convert PDF scans to searchable text and PDFs. Extract text from scans using Tesseract 5 OCR engine with language packs. | **OPERATIONAL** |
| **Extract Pages** | | `[WASM]` | `/extract-pages` | Visually select and extract desired pages into a standalone, pristine PDF document. | **OPERATIONAL** |

---

### Category 2: MERGE SUITE

| Tool Name | Execution Path | Route Path | Input Formats | Functional Algorithm & Technical Specification | Current Status |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Alternate & Mix** | `[WASM]` | `/alternate-mix` | 2x `.pdf` | Mixes pages from 2 or more documents, alternating between them. Essential for manual double-sided scans (interleaving Document A odd pages with Document B reversed even pages). | **IMPLEMENTED** |
| **Merge** | `[WASM]` / `[SERVER]` | `/merge-pdf` | `.pdf`, `.jpg`, `.png` | Combine multiple PDFs and images into one. Drag-and-drop reordering, thumbnail previews, and instant client-side concatenation via `pdf-lib`. | **OPERATIONAL** |
| **Organize** | `[WASM]` | `/organize-pdf` | `.pdf` | Arrange and reorder PDF pages visually on a grid canvas. Drag-to-reorder, duplicate, rotate, and delete pages before saving. | **IMPLEMENTED** |

---

### Category 3: SPLIT SUITE

| Tool Name | Execution Path | Route Path | Functional Algorithm & Technical Specification | Current Status |
| :--- | :--- | :--- | :--- | :--- |
| **Extract Pages** | `[WASM]` | `/extract-pages` | Get a new document containing only the desired pages selected visually on a multi-page grid. | **OPERATIONAL** |
| **Split by pages •** | `[WASM]` | `/split-pdf` | Split specific page ranges (e.g. `1-3, 5, 8-12`) or extract every single page into separate PDF files. | **OPERATIONAL** |
| **Split by bookmarks** | `[SERVER]` / `[WASM]` | `/split-by-bookmarks` | Inspects PDF Outline Catalog (`/Outlines`) and extracts chapters to separate documents based on table-of-contents bookmarks. | **IMPLEMENTED** |
| **Split in half** | `[WASM]` | `/split-in-half` | Slices two-page book scans down the middle (A3 to double A4 or A4 to double A5) by computing dual `MediaBox` / `CropBox` coordinate splits. | **IMPLEMENTED** |
| **Split by size** | `[SERVER]` | `/split-by-size` | Iteratively segments large PDF files into multiple smaller PDF parts adhering to a strict megabyte limit (e.g. max 10MB per file). | **IMPLEMENTED** |
| **Split by text** | `[WASM]` | `/split-by-text` | Evaluates PDF text streams and automatically extracts a new separate document whenever specific keyword text or header pattern changes. | **IMPLEMENTED** |

---

### Category 4: EDIT & SIGN SUITE

| Tool Name | Execution Path | Route Path | Functional Algorithm & Technical Specification | Current Status |
| :--- | :--- | :--- | :--- | :--- |
| **Edit •** | `[HYBRID]` | `/edit-pdf` | Full in-place PDF editor. Click existing text to edit/replace with automatic vector masking. Drag-to-draw whiteout redaction boxes. Stamp ✓ and ✗ marks, draw shapes, and insert logos. | **OPERATIONAL** |
| **Fill & Sign •** | `[HYBRID]` | `/fill-and-sign` | Freehand stylus/mouse signature drawing or typed cursive calligraphy signatures. Interactive form field filling and date stamping. | **OPERATIONAL** |
| **Create Forms** | `[HYBRID]` | `/create-forms` | Free PDF forms creator. Add fillable text inputs, radio buttons, checkboxes, and dropdown select fields onto static PDF templates. | **IMPLEMENTED** |
| **Delete Pages** | `[WASM]` | `/delete-pages` | One-click removal of unneeded, blank, or duplicate pages from any PDF document with instant client-side WASM saving. | **OPERATIONAL** |

---

### Category 5: COMPRESS & OPTIMIZE

| Tool Name | Execution Path | Route Path | Functional Algorithm & Technical Specification | Current Status |
| :--- | :--- | :--- | :--- | :--- |
| **Compress •** | `[SERVER]` | `/compress-pdf` | Reduces file size using Ghostscript vector downsampling, stripping unreferenced font descriptors, JBIG2 compression, and stream linearization. | **OPERATIONAL** |

---

### Category 6: SECURITY & INTEGRITY

| Tool Name | Execution Path | Route Path | Functional Algorithm & Technical Specification | Current Status |
| :--- | :--- | :--- | :--- | :--- |
| **Protect** | `[WASM]` / `[SERVER]` | `/protect-pdf` | Encrypts PDF documents with 256-bit AES standard. Configures user passwords, owner passwords, and permissions (printing, copying, form filling). | **OPERATIONAL** |
| **Unlock** | `[WASM]` / `[SERVER]` | `/unlock-pdf` | Strips password restrictions, owner security, and printing locks when authorized password or open master key is supplied. | **OPERATIONAL** |
| **Watermark** | `[WASM]` | `/watermark-pdf` | Stamps customizable semi-transparent diagonal text (e.g. "CONFIDENTIAL", "DRAFT") or image logos across every page with opacity and angle controls. | **OPERATIONAL** |
| **Flatten** | `[WASM]` | `/flatten-pdf` | Converts interactive AcroForm fields, digital signatures, and dynamic annotations into static read-only background vector content. | **IMPLEMENTED** |

---

### Category 7: CONVERT FROM PDF

| Tool Name | Execution Path | Route Path | Target Output | Technical Engine & Pipeline | Current Status |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **PDF to Excel** | `[SERVER]` | `/pdf-to-excel` | `.xlsx` / `.csv` | Tabular data extraction analyzing vector lines and text spacing into structured Excel spreadsheets. | **OPERATIONAL** |
| **PDF to JPG** | `[WASM]` | `/pdf-to-jpg` | `.zip` (JPG/PNG) | High-resolution rasterization (150/300 DPI) using client-side `PDF.js` HTML5 Canvas rendering. | **OPERATIONAL** |
| **PDF to Text •** | `[WASM]` | `/pdf-to-text` | `.txt` | Plaintext extraction preserving paragraph breaks without formatting bloat. | **IMPLEMENTED** |
| **PDF to Word •** | `[SERVER]` | `/pdf-to-word` | `.docx` | Headless LibreOffice conversion maintaining typographic styles and document layouts. | **OPERATIONAL** |

---

### Category 8: CONVERT TO PDF

| Tool Name | Execution Path | Route Path | Input Formats | Technical Engine & Pipeline | Current Status |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **JPG to PDF** | `[WASM]` | `/jpg-to-pdf` | `.jpg`, `.png`, `.webp` | Packages collections of photos, receipts, or scans into a clean PDF with A4/Letter sizing and margin adjustments. | **OPERATIONAL** |
| **Word to PDF** | `[SERVER]` | `/word-to-pdf` | `.docx`, `.doc`, `.odt`| Server-side LibreOffice engine rendering Microsoft Word documents into pixel-perfect PDF vectors. | **OPERATIONAL** |
| **Excel to PDF** | `[SERVER]` | `/excel-to-pdf` | `.xlsx`, `.xls` | Spreadsheets rendered to vector tables with pagination and column fitting. | **OPERATIONAL** |
| **PPT to PDF** | `[SERVER]` | `/powerpoint-to-pdf` | `.pptx`, `.ppt` | Slide deck vector rasterization preserving transitions, master slides, and layouts. | **OPERATIONAL** |

---

### Category 9: SCANS & DOCUMENT CLARITY

| Tool Name | Badge | Execution Path | Route Path | Functional Algorithm & Technical Specification | Current Status |
| :--- | :---: | :--- | :--- | :--- | :--- |
| **Deskew** | `New` | `[SERVER]` | `/deskew-pdf` | Automatically detects page tilt angle via Radon/Hough transform and rotates crooked scanner pages back to true vertical. | **IMPLEMENTED** |
| **OCR •** | | `[SERVER]` | `/ocr-pdf` | Tesseract 5 engine running layout detection to inject an invisible searchable font layer over scanned bitmaps. | **OPERATIONAL** |
| **Enhance Visibility** | `New` | `[WASM]` | `/enhance-pdf` | **EyeShots Exclusive:** Cleans muddy shadows and yellow paper casts while keeping authentic blue/red stamps, signatures, and handwriting genuine. | **OPERATIONAL** |

---

### Category 10: OTHER (Advanced Utilities & Document Formatting)

| Tool Name | Badge | Execution Path | Route Path | Functional Algorithm & Technical Specification | Current Status |
| :--- | :---: | :--- | :--- | :--- | :--- |
| **Bates Numbering** | | `[WASM]` | `/bates-numbering` | Legal document indexing injecting alphanumeric prefix/suffix counters (e.g. `CASE-001452`) across multi-file discovery batches. | **IMPLEMENTED** |
| **Create Bookmarks** | `New` | `[WASM]` | `/create-bookmarks` | Injects interactive hierarchical navigation bookmarks into the PDF Document Outline tree. | **IMPLEMENTED** |
| **Crop** | | `[WASM]` | `/crop-pdf` | Visual drag-to-crop handles adjusting `MediaBox`, `CropBox`, and `BleedBox` across all or specific pages. | **OPERATIONAL** |
| **Edit Metadata** | | `[WASM]` | `/edit-metadata` | Edits document Info Dictionary and XMP metadata (`Title`, `Author`, `Subject`, `Keywords`, `Creator`). | **IMPLEMENTED** |
| **Extract Images** | | `[SERVER]` | `/extract-images` | Dumps all embedded raster images from `/XObject` dictionaries in original resolution without recompression artifacts. | **IMPLEMENTED** |
| **Grayscale** | | `[SERVER]` | `/grayscale-pdf` | Converts all color spaces (`DeviceRGB`, `ICCBased`) to `DeviceGray` to drastically cut printer toner usage. | **IMPLEMENTED** |
| **Header & Footer** | | `[WASM]` | `/header-footer` | Injects header/footer text labels, copyright notices, and timestamps with margin alignment controls. | **IMPLEMENTED** |
| **N-up** | | `[WASM]` | `/n-up-pdf` | Imposition engine arranging 2-up, 4-up, or 8-up pages onto larger physical sheets (e.g. 2x A4 on A3). | **IMPLEMENTED** |
| **Page Numbers** | | `[WASM]` | `/add-page-numbers` | Injects page counters (`Page X of Y`) with position presets (Top/Bottom, Left/Center/Right). | **OPERATIONAL** |
| **Rename** | `New` | `[WASM]` | `/rename-pdf` | Dynamically renames document filenames based on extracted text (e.g. invoice numbers or client names). | **IMPLEMENTED** |
| **Repair** | | `[SERVER]` | `/repair-pdf` | Rebuilds corrupted cross-reference tables (`xref`), restores broken object streams, and recovers damaged PDFs via `qpdf`. | **OPERATIONAL** |
| **Resize** | | `[WASM]` | `/resize-pdf` | Adds page margins, adjusts padding, and scales canvas geometry between standard formats (A4, Letter, Legal). | **IMPLEMENTED** |
| **PDF Viewer** | | `[WASM]` | `/pdf-viewer` | Clean, lightning-fast browser reader with continuous scroll, zoom controls, and thumbnail drawer. | **OPERATIONAL** |

---

## 📊 Operational Status Summary

- **Total Tools in Catalog**: 37 Tools
- **Client-Side WASM (0 Server Cost)**: 23 Tools (62%)
- **Headless Stirling-PDF (High-Compute)**: 11 Tools (30%)
- **Hybrid Visual Suite (Canvas + WASM)**: 3 Tools (8%)
- **Operational & Active in Web / Gateway**: 100% Core coverage of Sejda's flagship features.
