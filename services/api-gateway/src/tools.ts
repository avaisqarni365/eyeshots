import { z } from 'zod';
import { isOfficeDocument, isPdf } from './security';
import type { FieldValue } from './stirling';

/**
 * Server-side tool registry, shared by the synchronous routes (/api/tools/:id),
 * the job API (/api/jobs/:id) and the queue worker — one definition per tool,
 * so validation and engine parameters can never drift between the two paths.
 */
export interface ServerTool<S extends z.ZodTypeAny = z.ZodTypeAny> {
  id: string;
  endpoint: string;
  /** Human description of accepted input, used in error messages. */
  kind: string;
  minFiles: number;
  maxFiles: number;
  validate: (name: string, buf: Buffer) => boolean;
  params: S;
  /** Maps validated params to Stirling form fields. */
  fields: (p: z.infer<S>) => Record<string, FieldValue>;
  /** Output filename from the first input's base name. */
  outputName: (base: string) => string;
}

const pdf = (_n: string, b: Buffer) => isPdf(b);
const noParams = z.object({}).passthrough().transform(() => ({}));
const passwordSchema = z.object({ password: z.string().min(1, 'Password is required').max(128) });

/** UI levels map onto Stirling's 1–9 scale (default 5). */
const COMPRESSION_LEVELS = { '1': 3, '2': 5, '3': 8 } as const;

function define<S extends z.ZodTypeAny>(t: ServerTool<S>): ServerTool<S> {
  return t;
}

export const SERVER_TOOLS: Record<string, ServerTool> = Object.fromEntries(
  [
    define({
      id: 'merge', endpoint: '/api/v1/general/merge-pdfs', kind: 'PDF', minFiles: 2, maxFiles: 20, validate: pdf,
      params: noParams, fields: () => ({}), outputName: () => 'merged.pdf',
    }),
    define({
      id: 'compress', endpoint: '/api/v1/misc/compress-pdf', kind: 'PDF', minFiles: 1, maxFiles: 1, validate: pdf,
      params: z.object({ optimizeLevel: z.enum(['1', '2', '3']).default('2') }),
      fields: (p) => ({ optimizeLevel: COMPRESSION_LEVELS[p.optimizeLevel as keyof typeof COMPRESSION_LEVELS] }),
      outputName: (b) => `${b}-compressed.pdf`,
    }),
    define({
      id: 'ocr', endpoint: '/api/v1/misc/ocr-pdf', kind: 'PDF', minFiles: 1, maxFiles: 1, validate: pdf,
      // Tesseract codes, e.g. "eng", "deu", or several joined by "+" / ",".
      params: z.object({ languages: z.string().regex(/^[a-z_]{3,10}([+,][a-z_]{3,10}){0,4}$/i).default('eng') }),
      fields: (p) => ({
        languages: p.languages.split(/[+,]/),
        ocrType: 'skip-text', // don't fail on PDFs that already contain text
        ocrRenderType: 'hocr',
        sidecar: false,
        deskew: true,
        clean: true,
      }),
      outputName: (b) => `${b}-ocr.pdf`,
    }),
    define({
      id: 'office-to-pdf', endpoint: '/api/v1/convert/file/pdf', kind: 'Word, Excel, PowerPoint or OpenDocument', minFiles: 1, maxFiles: 1,
      validate: isOfficeDocument, params: noParams, fields: () => ({}), outputName: (b) => `${b}.pdf`,
    }),
    define({
      id: 'pdf-to-word', endpoint: '/api/v1/convert/pdf/word', kind: 'PDF', minFiles: 1, maxFiles: 1, validate: pdf,
      params: noParams, fields: () => ({ outputFormat: 'docx' }), outputName: (b) => `${b}.docx`,
    }),
    define({
      id: 'protect', endpoint: '/api/v1/security/add-password', kind: 'PDF', minFiles: 1, maxFiles: 1, validate: pdf,
      params: passwordSchema, fields: (p) => ({ password: p.password, keyLength: 256 }), outputName: (b) => `${b}-protected.pdf`,
    }),
    define({
      id: 'unlock', endpoint: '/api/v1/security/remove-password', kind: 'PDF', minFiles: 1, maxFiles: 1, validate: pdf,
      params: passwordSchema, fields: (p) => ({ password: p.password }), outputName: (b) => `${b}-unlocked.pdf`,
    }),
    define({
      // Damaged files may lack a valid header, so accept by extension too.
      id: 'repair', endpoint: '/api/v1/misc/repair', kind: 'PDF', minFiles: 1, maxFiles: 1,
      validate: (n, b) => n.toLowerCase().endsWith('.pdf') || isPdf(b),
      params: noParams, fields: () => ({}), outputName: (b) => `${b}-repaired.pdf`,
    }),
    define({
      id: 'pdf-a', endpoint: '/api/v1/convert/pdf/pdfa', kind: 'PDF', minFiles: 1, maxFiles: 1, validate: pdf,
      params: noParams, fields: () => ({ outputFormat: 'pdfa-2b' }), outputName: (b) => `${b}-pdfa.pdf`,
    }),
    define({
      id: 'bates-numbering', endpoint: '/api/v1/misc/add-page-numbers', kind: 'PDF', minFiles: 1, maxFiles: 1, validate: pdf,
      params: z.object({
        prefix: z.string().max(40).regex(/^[\w\- .#/]*$/).default('EXHIBIT-'),
        startNumber: z.coerce.number().int().min(0).max(9_999_999).default(1),
        digits: z.coerce.number().int().min(1).max(10).default(6),
      }),
      fields: (p) => ({
        customText: `${p.prefix}{n}`,
        startingNumber: p.startNumber,
        zeroPad: p.digits,
        position: 9, // bottom-right on Stirling's 1–9 grid
        fontSize: 10,
      }),
      outputName: (b) => `${b}-bates.pdf`,
    }),
  ].map((t) => [t.id, t as unknown as ServerTool]),
);

/** Strips the extension from an uploaded file name for building output names. */
export function baseName(filename: string): string {
  const name = filename.split(/[\\/]/).pop() || 'document';
  return name.replace(/\.[^.]+$/, '').slice(0, 120) || 'document';
}
