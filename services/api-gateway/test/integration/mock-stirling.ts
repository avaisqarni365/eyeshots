import express from 'express';
import multer from 'multer';
import type { Server } from 'http';

/**
 * Minimal stand-in for the Stirling-PDF REST API, so integration tests run in CI
 * without the 2 GB engine image. Behaviour is driven by the uploaded content:
 *   - contains "ENGINE_REJECT" → 400 (like a corrupt PDF)
 *   - contains "ENGINE_DROP"   → socket destroyed (engine unavailable)
 *   - contains "ENGINE_SLOW"   → responds after 1.5 s
 *   - otherwise                → 200 with a tiny valid PDF
 * Every request is recorded and exposed at GET /__requests for assertions.
 */

export const TEST_API_KEY = 'test_internal_api_key_1234567890';

const TINY_PDF = Buffer.from(
  '%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n' +
    '3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 200 200]>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF\n',
  'latin1',
);

export interface RecordedRequest {
  endpoint: string;
  apiKey: string | undefined;
  fields: Record<string, string | string[]>;
  files: { name: string; size: number }[];
}

export function startMockStirling(port: number): Promise<Server> {
  const app = express();
  const upload = multer({ storage: multer.memoryStorage() });
  const requests: RecordedRequest[] = [];

  app.get('/api/v1/info/status', (_req, res) => res.json({ status: 'UP' }));
  app.get('/__requests', (_req, res) => res.json(requests));
  app.delete('/__requests', (_req, res) => { requests.length = 0; res.end(); });

  app.post('/api/v1/*', upload.array('fileInput'), (req, res) => {
    const files = (req.files as Express.Multer.File[]) || [];
    requests.push({
      endpoint: req.path,
      apiKey: req.header('x-api-key'),
      fields: req.body,
      files: files.map((f) => ({ name: f.originalname, size: f.size })),
    });
    if (req.header('x-api-key') !== TEST_API_KEY) return res.status(401).json({ error: 'bad key' });
    const content = Buffer.concat(files.map((f) => f.buffer)).toString('latin1');
    if (content.includes('ENGINE_DROP')) return req.socket.destroy();
    if (content.includes('ENGINE_REJECT')) return res.status(400).json({ title: 'PDF File Corrupted', detail: 'internal engine detail /tmp/x' });
    const send = () => {
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', 'attachment; filename="engine-output.pdf"');
      res.send(TINY_PDF);
    };
    if (content.includes('ENGINE_SLOW')) setTimeout(send, 1500);
    else send();
  });

  return new Promise((resolve) => {
    const server = app.listen(port, '127.0.0.1', () => resolve(server));
  });
}
