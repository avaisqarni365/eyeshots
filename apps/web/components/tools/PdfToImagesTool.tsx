'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Download, Square } from 'lucide-react';
import JSZip from 'jszip';
import { FileDropzone } from '@/components/FileDropzone';
import { Panel, Button, Alert, FileChip, Field, Segmented, Progress, inputCls } from '@/components/ui/primitives';
import { pdfToImagesClient, countPdfPages } from '@/lib/pdf/convert-tools';
import { parsePageRangeString, downloadZipBlob } from '@/lib/pdf/wasm-pipeline';
import { downloadFileBlob } from '@/lib/api/gateway-client';

export function PdfToImagesTool() {
  const [file, setFile] = useState<File | null>(null);
  const [pageCount, setPageCount] = useState<number | null>(null);
  const [format, setFormat] = useState<'jpeg' | 'png'>('jpeg');
  const [dpi, setDpi] = useState<'72' | '150' | '300'>('150');
  const [range, setRange] = useState('');
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => () => abortRef.current?.abort(), []);

  useEffect(() => {
    if (!file) return;
    setPageCount(null);
    countPdfPages(file).then(setPageCount).catch(() => setError('Could not read this PDF. It may be damaged or password-protected.'));
  }, [file]);

  const reset = () => { abortRef.current?.abort(); setFile(null); setDone(false); setError(null); setRange(''); };

  const run = async () => {
    if (!file || !pageCount) return;
    // parsePageRangeString returns 0-based indices; the renderer takes 1-based page numbers.
    const pages = range.trim() ? parsePageRangeString(range, pageCount).map((i) => i + 1) : [];
    if (range.trim() && pages.length === 0) { setError('No valid pages in that range.'); return; }
    setBusy(true); setError(null); setDone(false); setProgress(0);
    const ac = new AbortController();
    abortRef.current = ac;
    const base = file.name.replace(/\.pdf$/i, '');
    const ext = format === 'png' ? 'png' : 'jpg';
    const zip = new JSZip();
    const single: { blob?: Blob; n?: number } = {};
    let count = 0;
    try {
      await pdfToImagesClient(
        file,
        { dpi: Number(dpi), format, pages },
        (n, blob, total) => {
          count++;
          single.blob = blob; single.n = n;
          zip.file(`${base}-page-${String(n).padStart(3, '0')}.${ext}`, blob);
          setProgress((count / total) * 100);
        },
        ac.signal,
      );
      if (count === 1 && single.blob) downloadFileBlob(single.blob, `${base}-page-${single.n}.${ext}`);
      else downloadZipBlob(await zip.generateAsync({ type: 'blob' }), `${base}-images`);
      setDone(true);
    } catch (e) {
      if ((e as Error)?.name !== 'AbortError') setError(e instanceof Error ? e.message : 'Conversion failed.');
    } finally {
      setBusy(false);
    }
  };

  if (!file) return <FileDropzone onFileSelected={setFile} />;

  return (
    <Panel className="mx-auto max-w-2xl">
      <FileChip file={file} onRemove={reset} />
      <div className="mt-6 grid gap-5 sm:grid-cols-2">
        <Field label="Format">
          <Segmented value={format} onChange={setFormat} options={[{ value: 'jpeg', label: 'JPG' }, { value: 'png', label: 'PNG' }]} />
        </Field>
        <Field label="Resolution">
          <Segmented value={dpi} onChange={setDpi} options={[{ value: '72', label: 'Screen' }, { value: '150', label: 'Standard' }, { value: '300', label: 'Print' }]} />
        </Field>
        <div className="sm:col-span-2">
          <Field label="Pages" hint={pageCount ? `Leave empty for all ${pageCount} pages, or enter e.g. 1-3, 7` : 'Reading document…'}>
            <input value={range} onChange={(e) => setRange(e.target.value)} placeholder="All pages" className={inputCls} />
          </Field>
        </div>
      </div>
      <div className="mt-6 space-y-4">
        {busy && <Progress value={progress} label="Rendering pages" />}
        {error && <Alert kind="error">{error}</Alert>}
        {done && <Alert kind="success">Your images have been downloaded.</Alert>}
        <div className="flex gap-3">
          <Button onClick={run} loading={busy} disabled={!pageCount} className="flex-1"><Download className="h-4 w-4" /> Convert to {format === 'png' ? 'PNG' : 'JPG'}</Button>
          {busy && <Button variant="secondary" onClick={() => abortRef.current?.abort()}><Square className="h-4 w-4" /> Stop</Button>}
        </div>
      </div>
    </Panel>
  );
}
