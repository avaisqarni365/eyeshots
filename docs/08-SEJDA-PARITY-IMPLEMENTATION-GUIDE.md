# EyeShots: Sejda Parity Implementation Guide & Technical Blueprints

This architectural guide details the technical blueprint, API contracts, and browser-side WebAssembly routines required to execute every tool listed in [07-COMPLETE-OPERATIVE-PRODUCT-CATALOG.md](file:///d:/EyeShots/docs/07-COMPLETE-OPERATIVE-PRODUCT-CATALOG.md).

---

## 1. Top Navigation Bar Alignment

The top navigation bar matches Sejda's exact primary tool shortcuts:

```
[All Tools ▾]  [Compress]  [Edit]  [Fill & Sign]  [Delete Pages]  [Merge]  [Split]  [Viewer]
```

### Route Mappings:
- **Compress**: `/compress-pdf`
- **Edit**: `/edit-pdf`
- **Fill & Sign**: `/fill-and-sign`
- **Delete Pages**: `/delete-pages`
- **Merge**: `/merge-pdf`
- **Split**: `/split-pdf`
- **Viewer**: `/pdf-viewer`

---

## 2. Technical Execution Blueprints

### A. MERGE SUITE

#### 1. Alternate & Mix (`/alternate-mix`)
- **Execution Path**: `[WASM]` Client-side via `pdf-lib`.
- **Logic**:
  ```ts
  import { PDFDocument } from 'pdf-lib';

  export async function alternateAndMix(docABytes: ArrayBuffer, docBBytes: ArrayBuffer, reverseB: boolean = true) {
    const docA = await PDFDocument.load(docABytes);
    const docB = await PDFDocument.load(docBBytes);
    const outputDoc = await PDFDocument.create();

    const countA = docA.getPageCount();
    const countB = docB.getPageCount();
    const maxCount = Math.max(countA, countB);

    for (let i = 0; i < maxCount; i++) {
      if (i < countA) {
        const [pageA] = await outputDoc.copyPages(docA, [i]);
        outputDoc.addPage(pageA);
      }
      if (i < countB) {
        const bIndex = reverseB ? (countB - 1 - i) : i;
        const [pageB] = await outputDoc.copyPages(docB, [bIndex]);
        outputDoc.addPage(pageB);
      }
    }
    return await outputDoc.save();
  }
  ```

#### 2. Organize Pages (`/organize-pdf`)
- **Execution Path**: `[WASM]`
- **Logic**: Grid of page thumbnails. User can drag-and-drop to reorder indices.
  ```ts
  export async function reorderPages(pdfBytes: ArrayBuffer, newOrderIndices: number[]) {
    const doc = await PDFDocument.load(pdfBytes);
    const outputDoc = await PDFDocument.create();
    const copiedPages = await outputDoc.copyPages(doc, newOrderIndices);
    copiedPages.forEach((p) => outputDoc.addPage(p));
    return await outputDoc.save();
  }
  ```

---

### B. SPLIT SUITE

#### 1. Split in Half (`/split-in-half`)
- **Execution Path**: `[WASM]`
- **Use Case**: Slices 2-page book scans (e.g. A3 landscape containing two A4 portrait pages) down the middle.
- **Logic**:
  ```ts
  export async function splitInHalf(pdfBytes: ArrayBuffer) {
    const doc = await PDFDocument.load(pdfBytes);
    const outputDoc = await PDFDocument.create();

    for (let i = 0; i < doc.getPageCount(); i++) {
      const page = doc.getPage(i);
      const { width, height } = page.getSize();
      const halfWidth = width / 2;

      // Left page (0 to halfWidth)
      const [leftPage] = await outputDoc.copyPages(doc, [i]);
      leftPage.setCropBox(0, 0, halfWidth, height);
      outputDoc.addPage(leftPage);

      // Right page (halfWidth to width)
      const [rightPage] = await outputDoc.copyPages(doc, [i]);
      rightPage.setCropBox(halfWidth, 0, halfWidth, height);
      outputDoc.addPage(rightPage);
    }
    return await outputDoc.save();
  }
  ```

#### 2. Split by Bookmarks (`/split-by-bookmarks`)
- **Execution Path**: `[SERVER]` routed to Stirling-PDF `/api/v1/general/split-by-outline` or `[WASM]` reading PDF.js `getOutline()`.
- **Endpoint**:
  - URL: `POST /api/v1/general/split-by-outline`
  - Returns: `.zip` containing segmented PDFs named after bookmark titles.

---

### C. SECURITY & INTEGRITY

#### 1. Flatten PDF (`/flatten-pdf`)
- **Execution Path**: `[WASM]`
- **Use Case**: Renders interactive form text and digital signatures permanently into the base PDF content stream so form fields are completely read-only.
- **Logic**:
  ```ts
  export async function flattenFormFields(pdfBytes: ArrayBuffer) {
    const doc = await PDFDocument.load(pdfBytes);
    const form = doc.getForm();
    form.flatten();
    return await doc.save();
  }
  ```

---

### D. SCANS & DOCUMENT CLARITY

#### 1. Deskew PDF (`/deskew-pdf`)
- **Execution Path**: `[SERVER]` Stirling-PDF / OCRmyPDF
- **Endpoint**:
  - URL: `POST /api/v1/misc/deskew-pdf`
  - Parameters: `{ clean: true }`
  - Output: Straightened PDF without rotated scanner drift.

#### 2. Enhance Document Visibility (`/enhance-pdf`)
- **Execution Path**: `[WASM]` EyeShots Exclusive
- **Implementation**: [apps/web/lib/pdf/visibility-enhancer.ts](file:///d:/EyeShots/apps/web/lib/pdf/visibility-enhancer.ts)
- **Features**:
  - Presets: Magic Clean, Darken Ink, Crisp & Sharp, Warm Natural, Clean B&W, Original.
  - Controls: Paper White Level (`80%-150%`), Ink Depth (`100%-220%`), Edge Micro-Contrast (`0%-100%`).
  - Preserves 100% authentic blue/red notary stamps, seals, signatures, and handwriting.

---

### E. ADVANCED UTILITIES (OTHER)

#### 1. Bates Numbering (`/bates-numbering`)
- **Execution Path**: `[WASM]`
- **Logic**: Legal discovery indexing injecting zero-padded sequence numbers (e.g. `CONFIDENTIAL_PLAINTIFF_000100`).
  ```ts
  export async function addBatesNumbering(
    pdfBytes: ArrayBuffer,
    prefix: string = 'CASE-',
    startNumber: number = 1,
    padding: number = 6
  ) {
    const doc = await PDFDocument.load(pdfBytes);
    const font = await doc.embedFont('Helvetica-Bold');

    for (let i = 0; i < doc.getPageCount(); i++) {
      const page = doc.getPage(i);
      const numberStr = String(startNumber + i).padStart(padding, '0');
      const batesText = `${prefix}${numberStr}`;

      page.drawText(batesText, {
        x: page.getWidth() - 140,
        y: 20,
        size: 9,
        font,
      });
    }
    return await doc.save();
  }
  ```

#### 2. Grayscale PDF (`/grayscale-pdf`)
- **Execution Path**: `[SERVER]` Stirling-PDF
- **Endpoint**: `POST /api/v1/misc/grayscale-pdf`
- **Output**: PDF with all color spaces converted to monochromatic `DeviceGray` for low ink printing.

#### 3. Edit Metadata (`/edit-metadata`)
- **Execution Path**: `[WASM]`
- **Logic**:
  ```ts
  export async function updateMetadata(
    pdfBytes: ArrayBuffer,
    metadata: { title?: string; author?: string; subject?: string; keywords?: string[] }
  ) {
    const doc = await PDFDocument.load(pdfBytes);
    if (metadata.title) doc.setTitle(metadata.title);
    if (metadata.author) doc.setAuthor(metadata.author);
    if (metadata.subject) doc.setSubject(metadata.subject);
    if (metadata.keywords) doc.setKeywords(metadata.keywords);
    return await doc.save();
  }
  ```

#### 4. N-Up / Imposition (`/n-up-pdf`)
- **Execution Path**: `[WASM]`
- **Logic**: Compiles 2 or 4 pages onto a single A3 or A4 landscape sheet using `pdf-lib` sub-page scaling and translation offsets.

---

## 3. Ephemeral Janitor Lifecycle Guarantee

All server requests dispatched to `services/api-gateway`:
1. Are marked with `Date.now()`.
2. Stored strictly in ephemeral memory / temporary scratch space.
3. Automatically purged by [janitor.ts](file:///d:/EyeShots/services/api-gateway/src/janitor.ts) upon reaching 120-minute TTL.
4. Zero permanent S3 buckets or database blob storage.
