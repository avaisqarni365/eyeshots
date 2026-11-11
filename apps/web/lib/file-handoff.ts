/**
 * In-memory file hand-off between routes.
 *
 * When a user drops a file on the home page and then picks a tool, the File
 * object must survive client-side navigation. Storing it in localStorage is
 * impossible (and would persist document data, violating zero-retention), so
 * we keep it in a module-level variable that lives only for the tab's lifetime
 * and is consumed exactly once by the next <FileDropzone /> that mounts.
 */

let pending: { files: File[]; createdAt: number } | null = null;
const MAX_AGE_MS = 60_000;

export function setPendingFiles(files: File[]): void {
  pending = files.length ? { files, createdAt: Date.now() } : null;
}

/** Returns and clears pending files (if still fresh). */
export function takePendingFiles(): File[] | null {
  if (!pending) return null;
  const { files, createdAt } = pending;
  pending = null;
  return Date.now() - createdAt <= MAX_AGE_MS ? files : null;
}

export function hasPendingFiles(): boolean {
  return pending !== null && Date.now() - pending.createdAt <= MAX_AGE_MS;
}
