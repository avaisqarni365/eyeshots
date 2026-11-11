'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Download, GripVertical, Plus, X } from 'lucide-react';
import { FileDropzone } from '@/components/FileDropzone';
import { Panel, Button, Alert, Field, Segmented, Progress, inputCls } from '@/components/ui/primitives';
import { imagesToPdfClient, type OrientationOption, type PageSizeOption } from '@/lib/pdf/convert-tools';
import { downloadPdfBlob } from '@/lib/pdf/wasm-pipeline';

const ACCEPT = '.jpg,.jpeg,.png,.webp,.gif,.bmp,image/jpeg,image/png,image/webp,image/gif,image/bmp';

interface Item { id: string; file: File; url: string }

export function ImagesToPdfTool() {
  const [items, setItems] = useState<Item[]>([]);
  const [pageSize, setPageSize] = useState<PageSizeOption>('a4');
  const [orientation, setOrientation] = useState<OrientationOption>('auto');
  const [margin, setMargin] = useState(10);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const dragIndex = useRef<number | null>(null);
  const addInput = useRef<HTMLInputElement>(null);
  const itemsRef = useRef(items);
  itemsRef.current = items;

  // Revoke preview object URLs on unmount.
  useEffect(() => () => itemsRef.current.forEach((i) => URL.revokeObjectURL(i.url)), []);

  const add = (files: File[]) => {
    setDone(false);
    setItems((prev) => [
      ...prev,
      ...files.filter((f) => f.type.startsWith('image/')).map((file) => ({ id: crypto.randomUUID(), file, url: URL.createObjectURL(file) })),
    ]);
  };
  const remove = (id: string) =>
    setItems((prev) => {
      const it = prev.find((p) => p.id === id);
      if (it) URL.revokeObjectURL(it.url);
      return prev.filter((p) => p.id !== id);
    });

  const onDrop = (to: number) => {
    const from = dragIndex.current;
    dragIndex.current = null;
    if (from === null || from === to) return;
    setItems((prev) => {
      const next = [...prev];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      return next;
    });
  };

  const run = async () => {
    setBusy(true); setError(null); setDone(false); setProgress(0);
    try {
      const bytes = await imagesToPdfClient(items.map((i) => i.file), { pageSize, orientation, marginMm: margin }, (d, t) => setProgress((d / t) * 100));
      downloadPdfBlob(bytes, items.length === 1 ? items[0].file.name.replace(/\.[^.]+$/, '') : 'images');
      setDone(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Conversion failed. One of the images may be unsupported.');
    } finally {
      setBusy(false);
    }
  };

  if (items.length === 0) {
    return <FileDropzone multiple accept={ACCEPT} onFilesSelected={add} title="Drop images here" description="JPG, PNG, WebP, GIF or BMP. Drag to reorder after adding." />;
  }

  return (
    <Panel>
      <div className="grid gap-8 md:grid-cols-[1fr_260px]">
        <div>
          <div className="mb-3 flex items-center justify-between text-sm">
            <span className="font-medium text-slate-900 dark:text-white">{items.length} image{items.length > 1 ? 's' : ''}</span>
            <span className="text-xs text-slate-500">Drag to reorder</span>
          </div>
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {items.map((it, idx) => (
              <li
                key={it.id}
                draggable
                onDragStart={() => (dragIndex.current = idx)}
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => onDrop(idx)}
                className="group relative cursor-grab overflow-hidden rounded-xl border border-slate-200 bg-slate-50 active:cursor-grabbing dark:border-white/10 dark:bg-white/5"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={it.url} alt={it.file.name} className="aspect-[3/4] w-full object-contain p-2" />
                <div className="flex items-center gap-1 border-t border-slate-200 bg-white px-2 py-1.5 text-[11px] text-slate-600 dark:border-white/10 dark:bg-slate-900 dark:text-slate-300">
                  <GripVertical className="h-3 w-3 shrink-0 text-slate-400" />
                  <span className="truncate">{idx + 1}. {it.file.name}</span>
                </div>
                <button onClick={() => remove(it.id)} aria-label={`Remove ${it.file.name}`} className="absolute right-1.5 top-1.5 rounded-full bg-white/90 p-1 text-slate-500 opacity-0 shadow transition group-hover:opacity-100 hover:text-red-600 focus:opacity-100">
                  <X className="h-3.5 w-3.5" />
                </button>
              </li>
            ))}
            <li>
              <button onClick={() => addInput.current?.click()} className="flex aspect-[3/4] w-full flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-300 text-sm text-slate-500 hover:border-brand-400 hover:text-brand-600 dark:border-white/15">
                <Plus className="h-5 w-5" /> Add more
              </button>
              <input ref={addInput} type="file" multiple accept={ACCEPT} className="hidden" onChange={(e) => { if (e.target.files) add(Array.from(e.target.files)); e.target.value = ''; }} />
            </li>
          </ul>
        </div>

        <div className="space-y-5">
          <Field label="Page size">
            <Segmented value={pageSize} onChange={setPageSize} options={[{ value: 'a4', label: 'A4' }, { value: 'letter', label: 'Letter' }, { value: 'fit', label: 'Fit image' }]} />
          </Field>
          {pageSize !== 'fit' && (
            <Field label="Orientation">
              <Segmented value={orientation} onChange={setOrientation} options={[{ value: 'auto', label: 'Auto' }, { value: 'portrait', label: 'Portrait' }, { value: 'landscape', label: 'Landscape' }]} />
            </Field>
          )}
          <Field label="Margin (mm)">
            <input type="number" min={0} max={50} value={margin} onChange={(e) => setMargin(Math.max(0, Number(e.target.value) || 0))} className={inputCls} />
          </Field>
          {busy && <Progress value={progress} label="Building PDF" />}
          {error && <Alert kind="error">{error}</Alert>}
          {done && <Alert kind="success">Your PDF has been downloaded.</Alert>}
          <Button onClick={run} loading={busy} className="w-full"><Download className="h-4 w-4" /> Convert to PDF</Button>
        </div>
      </div>
    </Panel>
  );
}
