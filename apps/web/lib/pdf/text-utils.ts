import type { PDFFont } from 'pdf-lib';

// Characters in Windows-1252 above 0x7F that are not Latin-1 (0xA0–0xFF are fine).
const CP1252_EXTRAS = new Set('€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ');

/**
 * pdf-lib's 14 standard fonts (Helvetica, Times, Courier) only encode WinAnsi.
 * Drawing any other character (emoji, CJK, Cyrillic, arrows…) throws and aborts
 * the whole export. This maps common symbols to ASCII and replaces the rest.
 * For full Unicode output, embed a TTF via @pdf-lib/fontkit instead.
 */
export function toWinAnsi(text: string, replacement = '?'): string {
  let out = '';
  for (const ch of text) {
    const code = ch.codePointAt(0)!;
    if (code === 0x09) out += '    ';
    else if ((code >= 0x20 && code <= 0x7e) || (code >= 0xa0 && code <= 0xff) || CP1252_EXTRAS.has(ch)) out += ch;
    else if (ch === '→' || ch === '⟶') out += '->';
    else if (ch === '←') out += '<-';
    else if (ch === '↔' || ch === '⟷') out += '<->';
    else if (ch === '✓' || ch === '✔') out += 'v';
    else if (ch === '≥') out += '>=';
    else if (ch === '≤') out += '<=';
    else if (code >= 0x2000 && code <= 0x200b) out += ' ';
    else if (code < 0x20) continue;
    else out += replacement;
  }
  return out;
}

/** Greedy word-wrap measured with the actual font metrics. */
export function wrapText(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = '';
  const fits = (s: string) => font.widthOfTextAtSize(s, size) <= maxWidth;

  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (fits(candidate)) {
      line = candidate;
      continue;
    }
    if (line) lines.push(line);
    // Hard-break words longer than a full line (URLs, hashes…).
    let rest = word;
    while (!fits(rest) && rest.length > 1) {
      let cut = rest.length - 1;
      while (cut > 1 && !fits(rest.slice(0, cut))) cut--;
      lines.push(rest.slice(0, cut));
      rest = rest.slice(cut);
    }
    line = rest;
  }
  if (line) lines.push(line);
  return lines;
}
