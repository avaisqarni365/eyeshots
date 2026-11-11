'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Download } from 'lucide-react';
import { FileDropzone } from '@/components/FileDropzone';
import { Panel, Button, Alert, FileChip, Progress } from '@/components/ui/primitives';
import { officeToPdfServer, downloadFileBlob, type ServerProgress } from '@/lib/api/gateway-client';

export function OfficeToPdfTool({ accept, kind }: { accept: string; kind: string }) {
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<ServerProgress | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const run = async () => {
    if (!file) return;
    setBusy(true); setError(null); setDone(false); setProgress(null);
    try {
      const blob = await officeToPdfServer(file, setProgress);
      downloadFileBlob(blob, file.name.replace(/\.[^.]+$/, '') + '.pdf');
      setDone(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Conversion failed.');
    } finally {
      setBusy(false);
    }
  };

  if (!file) {
    return <FileDropzone accept={accept} onFileSelected={setFile} title={`Drop a ${kind} file here`} description="Converted with LibreOffice on an isolated worker and deleted automatically within 2 hours." />;
  }

  return (
    <Panel className="mx-auto max-w-xl">
      <FileChip file={file} onRemove={() => { setFile(null); setDone(false); setError(null); }} />
      <div className="mt-6 space-y-4">
        {busy && progress && <Progress value={progress.percent} label={progress.message} />}
        {error && (
          <Alert kind="error">
            {error}
            {/upgrade|\bpro\b/i.test(error) && <> <Link href="/pricing" className="font-semibold underline">See plans</Link></>}
          </Alert>
        )}
        {done && <Alert kind="success">Converted. Your PDF has been downloaded and the server copy has been deleted.</Alert>}
        <Button onClick={run} loading={busy} className="w-full"><Download className="h-4 w-4" /> Convert to PDF</Button>
      </div>
    </Panel>
  );
}
