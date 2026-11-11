'use client';

import React, { useEffect, useState } from 'react';
import { Download, RotateCcw } from 'lucide-react';
import * as pdfjsLib from 'pdfjs-dist';
import { FileDropzone } from '@/components/FileDropzone';
import { Panel, Button, Alert, FileChip, Field, Segmented, Progress, inputCls } from '@/components/ui/primitives';
import { cropPdfClient, type Margins } from '@/lib/pdf/convert-tools';
import { ensurePdfjsWorker, PDFJS_DOC_OPTIONS } from '@/lib/pdf/pdfjs-setup';
import { downloadPdfBlob } from '@/lib/pdf/wasm-pipeline';

const ZERO: Margins = { top: 0, right: 0, bottom: 0, left: 0 };

export function CropTool() {
  const [file, setFile] = useState<File | null>(null);
  const [mode, setMode] = useState<'manual' | 'auto'>('auto');
  const [margins, setMargins] = useState<Margins>({ top: 10, right: 10, bottom: 10, left: 10 });
  const [padding, setPadding] = useState(4);
  const [preview, setPreview] = useState<{ url: string; wMm: number; hMm: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!file) return;
    let cancelled = false;
    let doc: pdfjsLib.PDFDocumentProxy | null = null;
    (async () => {
      try {
        ensurePdfjsWorker();
        doc = await pdfjsLib.getDocument({ ...PDFJS_DOC_OPTIONS, data: new Uint8Array(await file.arrayBuffer()) }).promise;
        const page = await doc.getPage(1);
        const base = page.getViewport({ scale: 1 });
        const viewport = page.getViewport({ scale: 520 / base.width });
        const canvas = document.createElement('canvas');
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        const ctx = canvas.getContext('2d')!;
        ctx.fillStyle = '#fff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        await page.render({ canvasContext: ctx, viewport }).promise;
        if (!cancelled) setPreview({ url: canvas.toDataURL('image/jpeg', 0.85), wMm: (base.width * 25.4) / 72, hMm: (base.height * 25.4) / 72 });
      } catch {
        if (!cancelled) setError('Could not read this PDF. It may be damaged or password-protected.');
      } finally {
        await doc?.destroy();
      }
    })();
    return () => { cancelled = true; };
  }, [file]);

  const reset = () => { setFile(null); setPreview(null); setDone(false); setError(null); setProgress(0); };

  const run = async () => {
    if (!file) return;
    setBusy(true); setError(null); setDone(false); setProgress(0);
    try {
      const out = await cropPdfClient(
        file,
        mode === 'manual' ? { mode, margins } : { mode, paddingMm: padding },
        (d, t) => setProgress((d / t) * 100),
      );
      downloadPdfBlob(out, file.name.replace(/\.pdf$/i, '') + '-cropped.pdf');
      setDone(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Cropping failed.');
    } finally {
      setBusy(false);
    }
  };

  if (!file) return <FileDropzone onFileSelected={setFile} />;

  const set = (k: keyof Margins) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setMargins((m) => ({ ...m, [k]: Math.max(0, Number(e.target.value) || 0) }));

  return (
    <Panel>
      <FileChip file={file} onRemove={reset} />
      <div className="mt-6 grid gap-8 md:grid-cols-[1fr_280px]">
        <div className="flex items-start justify-center rounded-2xl bg-slate-100 p-4 dark:bg-white/5">
          {preview ? (
            <div className="relative w-full max-w-[420px] shadow-lg">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={preview.url} alt="First page preview" className="block w-full" />
              {mode === 'manual' && (
                <div
                  className="pointer-events-none absolute border-2 border-brand-500 shadow-[0_0_0_9999px_rgba(15,23,42,0.45)]"
                  style={{
                    top: `${(margins.top / preview.hMm) * 100}%`,
                    bottom: `${(margins.bottom / preview.hMm) * 100}%`,
                    left: `${(margins.left / preview.wMm) * 100}%`,
                    right: `${(margins.right / preview.wMm) * 100}%`,
                  }}
                />
              )}
            </div>
          ) : (
            <div className="h-72 w-full animate-pulse rounded-xl bg-slate-200 dark:bg-white/10" />
          )}
        </div>

        <div className="space-y-5">
          <Segmented value={mode} onChange={setMode} options={[{ value: 'auto', label: 'Auto-trim' }, { value: 'manual', label: 'Manual' }]} />
          {mode === 'auto' ? (
            <Field label="Padding around content (mm)" hint="Each page is analysed and white margins are removed automatically.">
              <input type="number" min={0} max={50} value={padding} onChange={(e) => setPadding(Math.max(0, Number(e.target.value) || 0))} className={inputCls} />
            </Field>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {(['top', 'bottom', 'left', 'right'] as const).map((k) => (
                <Field key={k} label={`${k[0].toUpperCase()}${k.slice(1)} (mm)`}>
                  <input type="number" min={0} value={margins[k]} onChange={set(k)} className={inputCls} />
                </Field>
              ))}
              <button onClick={() => setMargins(ZERO)} className="col-span-2 inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-slate-900 dark:hover:text-white">
                <RotateCcw className="h-3.5 w-3.5" /> Reset margins
              </button>
            </div>
          )}
          {busy && <Progress value={progress} label="Cropping pages" />}
          {error && <Alert kind="error">{error}</Alert>}
          {done && <Alert kind="success">Done — your cropped PDF has been downloaded.</Alert>}
          <Button onClick={run} loading={busy} className="w-full">
            <Download className="h-4 w-4" /> Crop &amp; download
          </Button>
        </div>
      </div>
    </Panel>
  );
}
