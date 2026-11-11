---
name: ephemeral-storage-janitor
description: Managing temporary document lifecycles, generating presigned S3 upload/download URLs, and executing strict 2-hour auto-deletion policies.
---

# Ephemeral Storage Janitor Skill

This skill guides AI agents in implementing strict, privacy-first file lifecycle rules where no uploaded or processed file persists beyond 120 minutes (2 hours).

---

## 1. Core Security Policy
- **No Permanent Document Persistence:** Files processed on the server exist solely in isolated temporary prefixes.
- **Strict Time-to-Live (TTL):** Exactly 7,200 seconds (2 hours) from the moment of initial upload.
- **Dual-Layer Deletion:** Both S3 Lifecycle Rules and active Redis TTL event-driven cleaners must be active.

---

## 2. Presigned URL Generation Pattern (AWS S3 / Cloudflare R2)

```typescript
import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { randomUUID } from 'crypto';

const s3 = new S3Client({
  region: process.env.AWS_REGION || 'auto',
  endpoint: process.env.S3_ENDPOINT, // Optional custom endpoint for Cloudflare R2 / MinIO
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

export async function createUploadSession(filename: string): Promise<{
  jobId: string;
  uploadUrl: string;
  s3Key: string;
}> {
  const jobId = randomUUID();
  const s3Key = `ephemeral/${jobId}/${filename}`;

  const command = new PutObjectCommand({
    Bucket: process.env.S3_BUCKET_NAME!,
    Key: s3Key,
    ContentType: 'application/pdf',
  });

  const uploadUrl = await getSignedUrl(s3, command, { expiresIn: 900 }); // 15-minute upload window

  return { jobId, uploadUrl, s3Key };
}
```

---

## 3. Active Janitor Cleanup Pattern (Redis Event / Cron)

```typescript
import { S3Client, DeleteObjectsCommand, ListObjectsV2Command } from '@aws-sdk/client-s3';

export async function purgeJobFiles(jobId: string): Promise<void> {
  const prefix = `ephemeral/${jobId}/`;

  // 1. List all files under the job prefix
  const listCommand = new ListObjectsV2Command({
    Bucket: process.env.S3_BUCKET_NAME!,
    Prefix: prefix,
  });

  const listResponse = await s3.send(listCommand);

  if (!listResponse.Contents || listResponse.Contents.length === 0) {
    return;
  }

  // 2. Bulk delete all objects in the folder
  const deleteCommand = new DeleteObjectsCommand({
    Bucket: process.env.S3_BUCKET_NAME!,
    Delete: {
      Objects: listResponse.Contents.map((obj) => ({ Key: obj.Key! })),
    },
  });

  await s3.send(deleteCommand);
  console.log(`[Janitor] Successfully purged ephemeral files for job: ${jobId}`);
}
```

---

## 4. Disaster Recovery & Audit Checklist
- Check for zero dangling blobs using automated daily reconciliation scripts.
- Log only anonymized file metadata (e.g. `size_bytes`, `page_count`, `duration_ms`), never the file contents or filenames containing personally identifiable information (PII).
