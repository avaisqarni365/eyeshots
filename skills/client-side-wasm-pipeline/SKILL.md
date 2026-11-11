---
name: client-side-wasm-pipeline
description: Executing zero-latency, zero-server-cost PDF operations (merge, split, rotate, watermark, page delete) in the browser using pdf-lib and WebAssembly.
---

# Client-Side WASM Pipeline Skill

This skill guides AI agents in implementing client-side PDF operations that execute entirely in the user's browser, eliminating server bandwidth and compute costs.

---

## 1. When to Use Client-Side Execution

Always prefer client-side execution for the following tasks:
- **Merging multiple PDFs**
- **Splitting PDF by pages or ranges**
- **Deleting, rotating, or reordering pages**
- **Adding page numbers or watermarks**
- **Extracting pages**
- **Adding / removing document metadata**

---

## 2. Core Implementation Patterns (`pdf-lib`)

### A. Merging PDFs in the Browser
```typescript
import { PDFDocument } from 'pdf-lib';

export async function mergePdfsClient(pdfArrayBuffers: ArrayBuffer[]): Promise<Uint8Array> {
  const mergedPdf = await PDFDocument.create();

  for (const buffer of pdfArrayBuffers) {
    const doc = await PDFDocument.load(buffer, { ignoreEncryption: true });
    const copiedPages = await mergedPdf.copyPages(doc, doc.getPageIndices());
    copiedPages.forEach((page) => mergedPdf.addPage(page));
  }

  return await mergedPdf.save();
}
```

### B. Rotating Specific Pages
```typescript
import { PDFDocument, degrees } from 'pdf-lib';

export async function rotatePagesClient(
  pdfBuffer: ArrayBuffer,
  pageRotations: Record<number, number> // { pageIndex: 90 | 180 | 270 }
): Promise<Uint8Array> {
  const doc = await PDFDocument.load(pdfBuffer);

  for (const [pageIdxStr, rotation] of Object.entries(pageRotations)) {
    const pageIndex = parseInt(pageIdxStr, 10);
    const page = doc.getPage(pageIndex);
    const currentRotation = page.getRotation().angle;
    page.setRotation(degrees(currentRotation + rotation));
  }

  return await doc.save();
}
```

### C. Deleting Pages
```typescript
import { PDFDocument } from 'pdf-lib';

export async function deletePagesClient(
  pdfBuffer: ArrayBuffer,
  pagesToDelete: number[] // 0-indexed page numbers
): Promise<Uint8Array> {
  const doc = await PDFDocument.load(pdfBuffer);
  
  // Sort descending to avoid index shifting
  const sortedIndices = [...pagesToDelete].sort((a, b) => b - a);
  for (const index of sortedIndices) {
    doc.removePage(index);
  }

  return await doc.save();
}
```

### D. Stamping Watermarks
```typescript
import { PDFDocument, rgb, degrees, StandardFonts } from 'pdf-lib';

export async function watermarkPdfClient(
  pdfBuffer: ArrayBuffer,
  watermarkText: string
): Promise<Uint8Array> {
  const doc = await PDFDocument.load(pdfBuffer);
  const font = await doc.embedFont(StandardFonts.HelveticaBold);
  const pages = doc.getPages();

  for (const page of pages) {
    const { width, height } = page.getSize();
    page.drawText(watermarkText, {
      x: width / 4,
      y: height / 2,
      size: 48,
      font,
      color: rgb(0.75, 0.75, 0.75),
      rotate: degrees(45),
      opacity: 0.4,
    });
  }

  return await doc.save();
}
```

---

## 3. Best Practices for AI Agents
- Always handle large files (>100MB) by wrapping the call in a Web Worker to prevent freezing the main UI thread.
- Provide instant blob download links using `URL.createObjectURL(new Blob([bytes], { type: 'application/pdf' }))`.
- Revoke object URLs immediately after download to free browser memory.
