/** Matches a file against an <input accept> style list (extensions, MIME types, wildcards). */
export function matchesAccept(file: Pick<File, 'name' | 'type'>, accept: string): boolean {
  const rules = accept.split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);
  if (rules.length === 0) return true;
  const name = file.name.toLowerCase();
  const type = (file.type || '').toLowerCase();
  return rules.some((rule) => {
    if (rule.startsWith('.')) return name.endsWith(rule);
    if (rule.endsWith('/*')) return type.startsWith(rule.slice(0, -1));
    return type === rule;
  });
}

/** Human-readable list of accepted extensions, e.g. ".PDF, .DOCX". */
export function describeAccept(accept: string): string {
  const exts = accept.split(',').map((s) => s.trim()).filter((s) => s.startsWith('.'));
  return exts.length ? exts.join(', ').toUpperCase() : 'supported';
}
