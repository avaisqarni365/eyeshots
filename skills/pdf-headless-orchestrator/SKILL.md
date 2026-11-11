---
name: pdf-headless-orchestrator
description: Interfacing with the headless Stirling-PDF engine via REST endpoints to execute heavy conversions, OCR, compression, and security tasks.
---

# PDF Headless Orchestrator Skill

This skill guides AI agents and developers in communicating with the containerized **Stirling-PDF** microservice to process heavy document workflows.

---

## 1. Core Endpoints Quick Reference

| Action | HTTP Method | Endpoint | Required Multipart Fields |
| :--- | :--- | :--- | :--- |
| **Merge Files** | `POST` | `/api/v1/general/merge` | `fileInput` (multiple files) |
| **OCR Document** | `POST` | `/api/v1/misc/ocr-pdf` | `fileInput`, `languages` (e.g. `eng`), `deskew`, `clean` |
| **Compress PDF** | `POST` | `/api/v1/general/compress-pdf` | `fileInput`, `optimizeLevel` (`1`, `2`, or `3`) |
| **Office to PDF** | `POST` | `/api/v1/convert/file/pdf` | `fileInput` (`.docx`, `.xlsx`, `.pptx`) |
| **PDF to Word** | `POST` | `/api/v1/convert/pdf/word` | `fileInput` (`.pdf`) |
| **Encrypt PDF** | `POST` | `/api/v1/security/add-password` | `fileInput`, `password`, `keyLength` (`256`) |
| **Decrypt PDF** | `POST` | `/api/v1/security/remove-password` | `fileInput`, `password` |
| **Repair PDF** | `POST` | `/api/v1/general/repair` | `fileInput` |

---

## 2. Standard TypeScript Integration Pattern

When writing code to invoke Stirling-PDF from the API Gateway or worker scripts, use this pattern:

```typescript
import axios from 'axios';
import FormData from 'form-data';
import fs from 'fs';

interface TaskOptions {
  endpoint: string;
  files: string[]; // Absolute paths on disk
  fields?: Record<string, string | number | boolean>;
  apiKey?: string;
}

export async function executeStirlingTask({
  endpoint,
  files,
  fields = {},
  apiKey = process.env.INTERNAL_STIRLING_API_KEY,
}: TaskOptions): Promise<Buffer> {
  const form = new FormData();

  // Attach files
  for (const filePath of files) {
    form.append('fileInput', fs.createReadStream(filePath));
  }

  // Attach parameters
  for (const [key, value] of Object.entries(fields)) {
    form.append(key, String(value));
  }

  const response = await axios.post(
    `${process.env.STIRLING_ENGINE_URL || 'http://localhost:8080'}${endpoint}`,
    form,
    {
      headers: {
        ...form.getHeaders(),
        ...(apiKey ? { 'X-API-KEY': apiKey } : {}),
      },
      responseType: 'arraybuffer',
      maxContentLength: Infinity,
      maxBodyLength: Infinity,
      timeout: 180000, // 3-minute timeout for heavy OCR
    }
  );

  return Buffer.from(response.data);
}
```

---

## 3. Error Handling Rules for AI Agents

1. **400 Bad Request:**
   - Inspect whether the uploaded file is corrupted or 0 bytes.
   - Do not re-attempt immediately; suggest `/repair-pdf` to the user.
2. **422 Unprocessable Entity:**
   - Usually indicates a password-protected PDF was supplied to an endpoint that requires unencrypted input.
   - Prompt user to unlock the document before processing.
3. **504 Gateway Timeout:**
   - Document exceeds memory or timeout limits.
   - Re-route job to a dedicated high-memory worker or split into smaller page chunks.
