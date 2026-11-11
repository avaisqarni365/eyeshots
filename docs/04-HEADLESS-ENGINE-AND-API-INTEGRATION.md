# Headless Engine & API Integration Guide

This guide details how the EyeShots SaaS Gateway interfaces with the containerized **Stirling-PDF** REST API, including endpoint mappings, authentication headers, request payloads, and error handling.

---

## 1. Engine Startup & Configuration

When deploying Stirling-PDF headlessly for EyeShots, configure the following environment variables:

```yaml
# docker-compose.yml snippet
services:
  stirling-pdf-core:
    image: frooodle/s-pdf:latest
    container_name: eyeshots-stirling-engine
    ports:
      - "8080:8080"
    environment:
      - DOCKER_ENABLE_SECURITY=true
      - SECURITY_ENABLELOGIN=false
      - SYSTEM_DEFAULTLOCALE=en_GB
      - UI_APPNAME=EyeShots Engine
      - API_KEY=${INTERNAL_STIRLING_API_KEY}
    restart: unless-stopped
```

Once running, interactive documentation is accessible at `http://localhost:8080/swagger-ui/index.html`.

---

## 2. Core Endpoint Mappings & Request Payloads

All requests to Stirling-PDF require multipart form-data. If security is enabled, include the `X-API-KEY` header.

### A. Document Merging (`/api/v1/general/merge`)
Combines multiple PDF files into one ordered document.

```bash
curl -X POST "http://localhost:8080/api/v1/general/merge" \
  -H "X-API-KEY: secret-key-here" \
  -H "accept: application/pdf" \
  -F "fileInput=@file1.pdf" \
  -F "fileInput=@file2.pdf" \
  --output merged.pdf
```

### B. Optical Character Recognition (`/api/v1/misc/ocr-pdf`)
Runs Tesseract / OCRmyPDF to produce a searchable PDF with selectable text.

```bash
curl -X POST "http://localhost:8080/api/v1/misc/ocr-pdf" \
  -H "X-API-KEY: secret-key-here" \
  -F "fileInput=@scanned_invoice.pdf" \
  -F "languages=eng" \
  -F "sidecar=false" \
  -F "deskew=true" \
  -F "clean=true" \
  --output searchable_invoice.pdf
```

### C. PDF Compression & Optimization (`/api/v1/general/compress-pdf`)
Reduces file size using qpdf and Ghostscript downsampling.

```bash
curl -X POST "http://localhost:8080/api/v1/general/compress-pdf" \
  -H "X-API-KEY: secret-key-here" \
  -F "fileInput=@heavy_document.pdf" \
  -F "optimizeLevel=2" \
  -F "expectedOutputSize=0" \
  --output compressed_document.pdf
```
*Note: `optimizeLevel` options: `1` (minimal compression), `2` (standard web balance), `3` (extreme downsampling).*

### D. Office Documents to PDF (`/api/v1/convert/file/pdf`)
Converts Microsoft Word, Excel, or PowerPoint files to PDF via headless LibreOffice.

```bash
curl -X POST "http://localhost:8080/api/v1/convert/file/pdf" \
  -H "X-API-KEY: secret-key-here" \
  -F "fileInput=@contract.docx" \
  --output contract.pdf
```

### E. PDF to Word (`/api/v1/convert/pdf/word`)
Extracts text and table boundaries into a `.docx` file.

```bash
curl -X POST "http://localhost:8080/api/v1/convert/pdf/word" \
  -H "X-API-KEY: secret-key-here" \
  -F "fileInput=@statement.pdf" \
  --output statement.docx
```

### F. Encrypt & Add Password (`/api/v1/security/add-password`)
Applies AES encryption and permission restrictions.

```bash
curl -X POST "http://localhost:8080/api/v1/security/add-password" \
  -H "X-API-KEY: secret-key-here" \
  -F "fileInput=@payroll.pdf" \
  -F "password=MasterPassword123" \
  -F "keyLength=256" \
  --output encrypted_payroll.pdf
```

---

## 3. SaaS Gateway Proxy Implementation (Node.js / TypeScript Example)

Below is the standard integration pattern used in our `services/api-gateway`:

```typescript
import axios from 'axios';
import FormData from 'form-data';
import fs from 'fs';

export async function processStirlingTask(
  endpoint: string,
  filePath: string,
  extraParams: Record<string, any> = {}
): Promise<Buffer> {
  const form = new FormData();
  form.append('fileInput', fs.createReadStream(filePath));

  for (const [key, value] of Object.entries(extraParams)) {
    form.append(key, String(value));
  }

  const response = await axios.post(
    `${process.env.STIRLING_ENGINE_URL}${endpoint}`,
    form,
    {
      headers: {
        ...form.getHeaders(),
        'X-API-KEY': process.env.INTERNAL_STIRLING_API_KEY,
      },
      responseType: 'arraybuffer',
      maxContentLength: Infinity,
      maxBodyLength: Infinity,
      timeout: 120000, // 2-minute timeout for large OCR tasks
    }
  );

  return Buffer.from(response.data);
}
```

---

## 4. Error Handling & Resilience
- **Corrupted Files (400 Bad Request):** Intercepted and reported to the user with a recommendation to use `/repair-pdf`.
- **Password-Protected Inputs (422 Unprocessable):** Intercepted by inspecting the PDF header before dispatch. If encrypted, the client is prompted to provide the decryption password.
- **Worker Timeouts (504 Gateway Timeout):** Enqueued in Redis BullMQ with automatic retries on a secondary worker node.
