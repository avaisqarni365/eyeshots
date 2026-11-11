import { PDFDocument, StandardFonts } from 'pdf-lib';

/** Creates a PDF whose pages are labelled "Page N" (sizes cycle if given), returned as an ArrayBuffer. */
export async function makePdf(pages: number, opts: { label?: string; sizes?: [number, number][] } = {}): Promise<ArrayBuffer> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  for (let i = 0; i < pages; i++) {
    const size = opts.sizes?.[i % opts.sizes.length] ?? [595, 842];
    const page = doc.addPage(size);
    page.drawText(`${opts.label ?? 'Page'} ${i + 1}`, { x: 50, y: size[1] - 80, size: 24, font });
  }
  const bytes = await doc.save();
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

export async function load(bytes: Uint8Array | ArrayBuffer) {
  return PDFDocument.load(bytes);
}

/** Page widths, used to tell pages apart when a test gives each page a unique size. */
export async function pageWidths(bytes: Uint8Array | ArrayBuffer): Promise<number[]> {
  const doc = await load(bytes);
  return doc.getPages().map((p) => Math.round(p.getWidth()));
}

/** Copies a Uint8Array into a standalone ArrayBuffer (what the pipeline APIs take). */
export function ab(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}
