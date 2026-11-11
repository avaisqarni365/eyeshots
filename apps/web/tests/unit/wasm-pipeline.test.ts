import { describe, it, expect } from 'vitest';
import { PDFDocument } from 'pdf-lib';
import {
  mergePdfsClient, rotatePagesClient, deletePagesClient, extractPagesClient, parsePageRangeString,
  watermarkPdfClient, addPageNumbersClient, alternateAndMixClient, splitInHalfClient, splitEveryNPagesClient, repairPdfClient,
} from '@/lib/pdf/wasm-pipeline';
import { makePdf, load, pageWidths, ab } from './helpers';

// Distinct page widths let us verify page order after each operation.
const sized = (n: number, start = 100) => Array.from({ length: n }, (_, i) => [start + i * 10, 800] as [number, number]);

describe('parsePageRangeString', () => {
  it('parses single pages and ranges into sorted, unique 0-based indices', () => {
    expect(parsePageRangeString('1-3, 5, 8-10', 12)).toEqual([0, 1, 2, 4, 7, 8, 9]);
    expect(parsePageRangeString('3,1,3,2', 5)).toEqual([0, 1, 2]);
  });
  it('clamps to the document and accepts reversed ranges', () => {
    expect(parsePageRangeString('4-2', 10)).toEqual([1, 2, 3]);
    expect(parsePageRangeString('8-20', 10)).toEqual([7, 8, 9]);
  });
  it('ignores garbage and out-of-range pages', () => {
    expect(parsePageRangeString('abc, 0, 99, , -', 5)).toEqual([]);
  });
});

describe('mergePdfsClient', () => {
  it('concatenates all pages in order', async () => {
    const a = await makePdf(2, { sizes: sized(2, 100) });
    const b = await makePdf(3, { sizes: sized(3, 300) });
    const out = await mergePdfsClient([a, b]);
    expect(await pageWidths(out)).toEqual([100, 110, 300, 310, 320]);
  });
  it('requires at least two documents', async () => {
    await expect(mergePdfsClient([await makePdf(1)])).rejects.toThrow(/at least 2/);
  });
});

describe('rotatePagesClient', () => {
  it('adds rotation relative to the current angle and normalises it', async () => {
    const out = await rotatePagesClient(await makePdf(3), { 0: 90, 2: -90 });
    const doc = await load(out);
    expect(doc.getPages().map((p) => p.getRotation().angle)).toEqual([90, 0, 270]);
    const twice = await load(await rotatePagesClient(ab(out), { 0: 270 }));
    expect(twice.getPage(0).getRotation().angle).toBe(0);
  });
});

describe('deletePagesClient / extractPagesClient', () => {
  it('deletes the selected pages regardless of order', async () => {
    const out = await deletePagesClient(await makePdf(5, { sizes: sized(5) }), [3, 0]);
    expect(await pageWidths(out)).toEqual([110, 120, 140]);
  });
  it('refuses to delete every page', async () => {
    await expect(deletePagesClient(await makePdf(2), [0, 1])).rejects.toThrow(/all pages/);
  });
  it('extracts pages into a new document', async () => {
    const out = await extractPagesClient(await makePdf(4, { sizes: sized(4) }), [3, 1, 99]);
    expect(await pageWidths(out)).toEqual([130, 110]);
  });
  it('throws when nothing valid is selected', async () => {
    await expect(extractPagesClient(await makePdf(2), [5])).rejects.toThrow(/No valid pages/);
  });
});

describe('split helpers', () => {
  it('splits in half (odd counts put the extra page first)', async () => {
    const { part1, part2 } = await splitInHalfClient(await makePdf(5, { sizes: sized(5) }));
    expect(await pageWidths(part1)).toEqual([100, 110, 120]);
    expect(await pageWidths(part2)).toEqual([130, 140]);
  });
  it('splits every N pages', async () => {
    const parts = await splitEveryNPagesClient(await makePdf(5, { sizes: sized(5) }), 2);
    expect(await Promise.all(parts.map(pageWidths))).toEqual([[100, 110], [120, 130], [140]]);
    await expect(splitEveryNPagesClient(await makePdf(1), 0)).rejects.toThrow();
  });
  it('alternates and mixes (with reversed B for duplex scans)', async () => {
    const a = await makePdf(2, { sizes: sized(2, 100) });
    const b = await makePdf(3, { sizes: sized(3, 300) });
    expect(await pageWidths(await alternateAndMixClient(a, b))).toEqual([100, 300, 110, 310, 320]);
    expect(await pageWidths(await alternateAndMixClient(a, b, true))).toEqual([100, 320, 110, 310, 300]);
  });
});

describe('stamping', () => {
  it('watermarks every page without changing the page count', async () => {
    const src = await makePdf(3);
    const out = await watermarkPdfClient(src, { text: 'CONFIDENTIAL', opacity: 0.2 });
    expect((await load(out)).getPageCount()).toBe(3);
    expect(out.byteLength).toBeGreaterThan(src.byteLength);
  });
  it('adds page numbers to every page', async () => {
    const src = await makePdf(4);
    const out = await addPageNumbersClient(src, 'bottom-right', 1);
    expect((await load(out)).getPageCount()).toBe(4);
    expect(out.byteLength).toBeGreaterThan(src.byteLength);
  });
});

describe('repairPdfClient', () => {
  it('re-serialises a valid document and reports recovered pages', async () => {
    const report = await repairPdfClient(await makePdf(3));
    expect(report.pagesRecovered).toBe(3);
    expect((await PDFDocument.load(report.repairedBytes)).getPageCount()).toBe(3);
  });
  it('rejects input that is not a PDF at all', async () => {
    await expect(repairPdfClient(new TextEncoder().encode('hello world').buffer as ArrayBuffer)).rejects.toThrow();
  });
});
