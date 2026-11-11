/**
 * Only allow same-site relative redirect targets for ?next= (prevents open
 * redirects such as ?next=//evil.example or ?next=https://evil.example).
 */
export function safeNext(next: string | null | undefined, fallback = '/account'): string {
  if (!next || !next.startsWith('/') || next.startsWith('//') || next.includes('\\')) return fallback;
  // Reject control characters, which some browsers strip (e.g. "/\t/evil.example").
  if (/[\x00-\x1f]/.test(next)) return fallback;
  return next;
}
