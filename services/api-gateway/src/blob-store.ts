import fs from 'fs';
import fsp from 'fs/promises';
import path from 'path';
import { Readable } from 'stream';
import {
  S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand, ListObjectsV2Command, DeleteObjectsCommand,
} from '@aws-sdk/client-s3';
import { config } from './config';

/**
 * Ephemeral blob storage for queued jobs (inputs and results).
 *
 * Zero-retention contract: every object is deleted by `sweepExpired()` once it
 * is older than JOB_TTL_MINUTES, inputs are deleted as soon as a job finishes,
 * and results are deleted when the client confirms the download (DELETE /jobs/:id).
 * Keys are random UUIDs and never contain user file names.
 */
export interface BlobStore {
  put(key: string, data: Buffer): Promise<void>;
  get(key: string): Promise<{ stream: Readable; size?: number }>;
  getBuffer(key: string): Promise<Buffer>;
  delete(key: string): Promise<void>;
  /** Deletes every object older than maxAgeMs; returns the number deleted. */
  sweepExpired(maxAgeMs: number): Promise<number>;
  readonly kind: string;
}

async function streamToBuffer(stream: Readable): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of stream) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  return Buffer.concat(chunks);
}

/** Local directory store. In Docker this directory is a shared tmpfs (RAM) volume. */
export class FsBlobStore implements BlobStore {
  readonly kind = 'fs';
  constructor(private readonly dir: string) {
    fs.mkdirSync(dir, { recursive: true });
  }
  private file(key: string) {
    if (!/^[a-z0-9-]+(\/[a-z0-9.-]+)?$/i.test(key)) throw new Error('Invalid blob key');
    return path.join(this.dir, key.replace('/', '__'));
  }
  async put(key: string, data: Buffer) {
    await fsp.writeFile(this.file(key), data, { mode: 0o600 });
  }
  async get(key: string) {
    const f = this.file(key);
    const { size } = await fsp.stat(f);
    return { stream: fs.createReadStream(f), size };
  }
  async getBuffer(key: string) {
    return fsp.readFile(this.file(key));
  }
  async delete(key: string) {
    await fsp.rm(this.file(key), { force: true });
  }
  async sweepExpired(maxAgeMs: number) {
    const now = Date.now();
    let n = 0;
    for (const name of await fsp.readdir(this.dir).catch(() => [] as string[])) {
      const f = path.join(this.dir, name);
      try {
        const st = await fsp.stat(f);
        if (now - st.mtimeMs > maxAgeMs) {
          await fsp.rm(f, { force: true, recursive: true });
          n++;
        }
      } catch {}
    }
    return n;
  }
}

/**
 * S3 / S3-compatible store (AWS, MinIO, Cloudflare R2, Hetzner…), required when
 * gateway and workers run on different hosts. Configure server-side encryption
 * and, as a backstop only, a 1-day lifecycle rule on the bucket — S3 lifecycle
 * granularity is days, so the 2-hour guarantee comes from sweepExpired().
 */
export class S3BlobStore implements BlobStore {
  readonly kind = 's3';
  private client: S3Client;
  constructor(private readonly bucket: string, private readonly prefix: string) {
    this.client = new S3Client({
      region: config.S3_REGION,
      endpoint: config.S3_ENDPOINT,
      forcePathStyle: config.S3_FORCE_PATH_STYLE,
    });
  }
  private k(key: string) {
    return `${this.prefix}${key}`;
  }
  async put(key: string, data: Buffer) {
    await this.client.send(new PutObjectCommand({ Bucket: this.bucket, Key: this.k(key), Body: data, ServerSideEncryption: 'AES256' }));
  }
  async get(key: string) {
    const res = await this.client.send(new GetObjectCommand({ Bucket: this.bucket, Key: this.k(key) }));
    return { stream: res.Body as Readable, size: res.ContentLength };
  }
  async getBuffer(key: string) {
    return streamToBuffer((await this.get(key)).stream);
  }
  async delete(key: string) {
    await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: this.k(key) }));
  }
  async sweepExpired(maxAgeMs: number) {
    const cutoff = Date.now() - maxAgeMs;
    let token: string | undefined;
    let n = 0;
    do {
      const page = await this.client.send(new ListObjectsV2Command({ Bucket: this.bucket, Prefix: this.prefix, ContinuationToken: token }));
      const expired = (page.Contents ?? []).filter((o) => o.Key && o.LastModified && o.LastModified.getTime() < cutoff);
      if (expired.length) {
        await this.client.send(new DeleteObjectsCommand({ Bucket: this.bucket, Delete: { Objects: expired.map((o) => ({ Key: o.Key! })), Quiet: true } }));
        n += expired.length;
      }
      token = page.IsTruncated ? page.NextContinuationToken : undefined;
    } while (token);
    return n;
  }
}

let store: BlobStore | null = null;

export function getBlobStore(): BlobStore {
  if (!store) {
    store = config.JOB_STORE === 's3'
      ? new S3BlobStore(config.S3_BUCKET!, config.S3_PREFIX)
      : new FsBlobStore(config.JOB_STORE_DIR);
  }
  return store;
}
