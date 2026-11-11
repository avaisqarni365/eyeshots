---
name: in-place-pdf-editor
description: Building interactive visual PDF editing surfaces with PDF.js and Fabric.js, managing annotations, electronic signatures, and flattening vector edits into PDF streams.
---

# In-Place PDF Editor Skill

This skill guides AI agents in implementing the interactive PDF editor, annotation layers, electronic signatures, and document flattening engines.

---

## 1. Canvas Layering Architecture

The visual editor combines three stacked HTML5 elements per PDF page:

```
┌────────────────────────────────────────────────────────┐
│  Top: Fabric.js Interactive Canvas (pointer-events: auto)│
│  - Text boxes, drawn signatures, redactions, shapes    │
├────────────────────────────────────────────────────────┤
│  Middle: PDF.js Text Layer (opacity: 0, selectable)    │
│  - Enables native browser text selection & search      │
├────────────────────────────────────────────────────────┤
│  Bottom: PDF.js Viewport Canvas (pointer-events: none) │
│  - Renders base PDF vector graphics & images           │
└────────────────────────────────────────────────────────┘
```

---

## 2. Rendering the Dual-Canvas Stack (React Example)

```tsx
import React, { useEffect, useRef } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import { fabric } from 'fabric';

interface PageEditorProps {
  pdfDocument: pdfjsLib.PDFDocumentProxy;
  pageNumber: number;
}

export const PageEditor: React.FC<PageEditorProps> = ({ pdfDocument, pageNumber }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fabricRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    let fabricCanvas: fabric.Canvas | null = null;

    async function renderPage() {
      const page = await pdfDocument.getPage(pageNumber);
      const viewport = page.getViewport({ scale: 1.5 });

      // 1. Render Base PDF Canvas
      const baseCanvas = canvasRef.current!;
      baseCanvas.width = viewport.width;
      baseCanvas.height = viewport.height;
      const ctx = baseCanvas.getContext('2d')!;

      await page.render({ canvasContext: ctx, viewport }).promise;

      // 2. Initialize Fabric.js Overlay
      fabricCanvas = new fabric.Canvas(fabricRef.current, {
        width: viewport.width,
        height: viewport.height,
        selection: true,
      });
    }

    renderPage();

    return () => {
      fabricCanvas?.dispose();
    };
  }, [pdfDocument, pageNumber]);

  return (
    <div className="relative border shadow-md my-4">
      {/* Base Render */}
      <canvas ref={canvasRef} className="absolute top-0 left-0" />
      {/* Interactive Overlay */}
      <canvas ref={fabricRef} className="relative z-10" />
    </div>
  );
};
```

---

## 3. Flattening Edits into the PDF Output (`pdf-lib`)

When the user clicks "Save & Download", the frontend serializes the Fabric.js objects (text, signatures, rectangles) and stamps them into the PDF using `pdf-lib`:

```typescript
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';

export async function flattenAnnotations(
  originalPdfBuffer: ArrayBuffer,
  annotationsByPage: Record<number, Array<{ type: string; x: number; y: number; text?: string; width?: number; height?: number }>>
): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.load(originalPdfBuffer);
  const helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica);

  for (const [pageIdxStr, annotations] of Object.entries(annotationsByPage)) {
    const pageIndex = parseInt(pageIdxStr, 10);
    const page = pdfDoc.getPage(pageIndex);
    const { height } = page.getSize();

    for (const item of annotations) {
      if (item.type === 'text' && item.text) {
        // PDF coordinates start from bottom-left, Canvas from top-left
        page.drawText(item.text, {
          x: item.x,
          y: height - item.y - 12,
          size: 14,
          font: helvetica,
          color: rgb(0, 0, 0),
        });
      } else if (item.type === 'whiteout') {
        page.drawRectangle({
          x: item.x,
          y: height - item.y - (item.height || 20),
          width: item.width || 100,
          height: item.height || 20,
          color: rgb(1, 1, 1), // Opaque white
        });
      }
    }
  }

  return await pdfDoc.save();
}
```
