import { describe, it, expect, vi, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import { PDFDocument, StandardFonts } from 'pdf-lib';
import { matchesAccept, describeAccept } from '@/lib/files/accept';
import { safeNext } from '@/lib/auth/safe-next';
import { toUnrotated, jpegOrientation } from '@/lib/pdf/geometry';
import { toWinAnsi, wrapText } from '@/lib/pdf/text-utils';
import { setPendingFiles, takePendingFiles, hasPendingFiles } from '@/lib/file-handoff';
import { PDF_TOOLS, TOOL_CATEGORIES, relatedTools, searchTools, getTool } from '@/lib/tools-data';

const file = (name: string, type = '') => ({ name, type });

describe('matchesAccept', () => {
  it('matches extensions case-insensitively', () => {
    expect(matchesAccept(file('Report.PDF'), '.pdf,application/pdf')).toBe(true);
    expect(matchesAccept(file('photo.jpg'), '.pdf,application/pdf')).toBe(false);
  });
  it('matches exact and wildcard MIME types', () => {
    expect(matchesAccept(file('x', 'application/pdf'), 'application/pdf')).toBe(true);
    expect(matchesAccept(file('x', 'image/webp'), 'image/*')).toBe(true);
    expect(matchesAccept(file('x', 'text/plain'), 'image/*')).toBe(false);
  });
  it('accepts anything when the list is empty', () => {
    expect(matchesAccept(file('anything.bin'), '')).toBe(true);
  });
  it('describes accepted extensions', () => {
    expect(describeAccept('.docx,.doc,application/msword')).toBe('.DOCX, .DOC');
  });
});

describe('safeNext (open-redirect protection)', () => {
  it.each(['/account', '/pricing?checkout=pro&interval=year'])('allows same-site path %s', (p) => {
    expect(safeNext(p)).toBe(p);
  });
  it.each([null, '', 'https://evil.example', '//evil.example', '/\\evil.example', '/\t/evil.example', 'javascript:alert(1)'])(
    'rejects %s',
    (p) => {
      expect(safeNext(p as string | null)).toBe('/account');
    },
  );
});

describe('toUnrotated (crop margins on rotated pages)', () => {
  const m = { top: 1, right: 2, bottom: 3, left: 4 };
  it('is the identity at 0° and 360°', () => {
    expect(toUnrotated(m, 0)).toEqual(m);
    expect(toUnrotated(m, 360)).toEqual(m);
  });
  it('maps visual edges for 90/180/270 and negative angles', () => {
    expect(toUnrotated(m, 90)).toEqual({ top: 2, right: 3, bottom: 4, left: 1 });
    expect(toUnrotated(m, 180)).toEqual({ top: 3, right: 4, bottom: 1, left: 2 });
    expect(toUnrotated(m, 270)).toEqual({ top: 4, right: 1, bottom: 2, left: 3 });
    expect(toUnrotated(m, -90)).toEqual(toUnrotated(m, 270));
  });
});

describe('jpegOrientation', () => {
  /** Minimal JPEG: SOI + APP1/Exif with a single Orientation IFD entry. */
  function jpegWithOrientation(o: number, littleEndian = false) {
    const tiff: number[] = littleEndian
      ? [0x49, 0x49, 0x2a, 0x00, 0x08, 0, 0, 0, 0x01, 0x00, 0x12, 0x01, 0x03, 0x00, 0x01, 0, 0, 0, o, 0x00, 0, 0, 0, 0, 0, 0]
      : [0x4d, 0x4d, 0x00, 0x2a, 0, 0, 0, 0x08, 0x00, 0x01, 0x01, 0x12, 0x00, 0x03, 0, 0, 0, 0x01, 0x00, o, 0, 0, 0, 0, 0, 0];
    const payload = [0x45, 0x78, 0x69, 0x66, 0, 0, ...tiff];
    const len = payload.length + 2;
    return new Uint8Array([0xff, 0xd8, 0xff, 0xe1, len >> 8, len & 0xff, ...payload, 0xff, 0xd9]).buffer;
  }
  it('reads orientation from big- and little-endian EXIF', () => {
    expect(jpegOrientation(jpegWithOrientation(6))).toBe(6);
    expect(jpegOrientation(jpegWithOrientation(3, true))).toBe(3);
  });
  it('defaults to 1 for non-JPEG or EXIF-less data', () => {
    expect(jpegOrientation(new Uint8Array([0x89, 0x50, 0x4e, 0x47]).buffer)).toBe(1);
    expect(jpegOrientation(new Uint8Array([0xff, 0xd8, 0xff, 0xd9]).buffer)).toBe(1);
  });
});

describe('toWinAnsi / wrapText (standard-font safe text)', () => {
  it('keeps Latin-1 and CP1252 characters, maps arrows, replaces the rest', () => {
    expect(toWinAnsi('Grüße — “quoted” €5')).toBe('Grüße — “quoted” €5');
    expect(toWinAnsi('EN ⟷ DE → ok')).toBe('EN <-> DE -> ok');
    expect(toWinAnsi('Привет 你好 🎉')).toBe('?????? ?? ?');
  });
  it('output can actually be encoded by Helvetica', async () => {
    const doc = await PDFDocument.create();
    const font = await doc.embedFont(StandardFonts.Helvetica);
    expect(() => font.encodeText(toWinAnsi('Mixed ✓ ≥ 中文 ⟷ text'))).not.toThrow();
  });
  it('wraps to the given width and hard-breaks very long words', async () => {
    const doc = await PDFDocument.create();
    const font = await doc.embedFont(StandardFonts.Helvetica);
    const long = 'The quick brown fox jumps over the lazy dog. '.repeat(10);
    const lines = wrapText(long, font, 10, 200);
    expect(lines.length).toBeGreaterThan(5);
    for (const l of lines) expect(font.widthOfTextAtSize(l, 10)).toBeLessThanOrEqual(200);
    expect(lines.join(' ').replace(/\s+/g, ' ')).toBe(long.trim().replace(/\s+/g, ' '));
    const url = 'https://example.com/' + 'a'.repeat(200);
    for (const l of wrapText(url, font, 10, 100)) expect(font.widthOfTextAtSize(l, 10)).toBeLessThanOrEqual(100);
  });
});

describe('file hand-off (in-memory, never persisted)', () => {
  afterEach(() => vi.useRealTimers());
  it('hands files over exactly once', () => {
    const f = new File(['x'], 'a.pdf');
    setPendingFiles([f]);
    expect(hasPendingFiles()).toBe(true);
    expect(takePendingFiles()).toEqual([f]);
    expect(takePendingFiles()).toBeNull();
  });
  it('expires stale hand-offs after a minute', () => {
    vi.useFakeTimers();
    setPendingFiles([new File(['x'], 'a.pdf')]);
    vi.advanceTimersByTime(61_000);
    expect(hasPendingFiles()).toBe(false);
    expect(takePendingFiles()).toBeNull();
  });
});

describe('tool registry', () => {
  const appDir = path.resolve(__dirname, '../../app');

  it('has unique ids, slugs and paths', () => {
    for (const key of ['id', 'slug', 'path'] as const) {
      const values = PDF_TOOLS.map((t) => t[key]);
      expect(new Set(values).size).toBe(values.length);
    }
  });
  it('every tool has a page (no 404s from the menu)', () => {
    const missing = PDF_TOOLS.filter((t) => !fs.existsSync(path.join(appDir, t.slug, 'page.tsx')));
    expect(missing.map((t) => t.path)).toEqual([]);
  });
  it('every tool page has SEO metadata (page or layout exports toolMetadata)', () => {
    const missing = PDF_TOOLS.filter((t) => {
      const files = ['page.tsx', 'layout.tsx'].map((f) => path.join(appDir, t.slug, f)).filter(fs.existsSync);
      return !files.some((f) => fs.readFileSync(f, 'utf8').includes(`toolMetadata('${t.id}')`));
    });
    expect(missing.map((t) => t.path)).toEqual([]);
  });
  it('every tool belongs to a known category and has an SEO description', () => {
    const cats = new Set(TOOL_CATEGORIES.map((c) => c.id));
    for (const t of PDF_TOOLS) {
      expect(cats.has(t.category)).toBe(true);
      expect(t.seoDescription.length).toBeGreaterThan(50);
    }
  });
  it('related tools never include the tool itself', () => {
    for (const t of PDF_TOOLS) expect(relatedTools(t.id).map((r) => r.id)).not.toContain(t.id);
  });
  it('search ranks name matches first and uses keywords', () => {
    expect(searchTools('merge')[0].id).toBe('merge-pdf');
    expect(searchTools('docx').map((t) => t.id)).toContain('word-to-pdf');
    expect(searchTools('   ')).toEqual([]);
    expect(getTool('nope')).toBeUndefined();
  });
});
