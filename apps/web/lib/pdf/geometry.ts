/** Pure helpers for page geometry and image metadata (no pdf.js / DOM dependencies). */

export const MM_TO_PT = 72 / 25.4;

export interface Margins { top: number; right: number; bottom: number; left: number } // in mm

/** Maps margins measured on the *displayed* page to the unrotated PDF coordinate frame. */
export function toUnrotated(m: Margins, rotation: number): Margins {
  switch (((rotation % 360) + 360) % 360) {
    case 90: return { top: m.right, right: m.bottom, bottom: m.left, left: m.top };
    case 180: return { top: m.bottom, right: m.left, bottom: m.top, left: m.right };
    case 270: return { top: m.left, right: m.top, bottom: m.right, left: m.bottom };
    default: return m;
  }
}

/** Reads the EXIF orientation tag of a JPEG (1 = normal). */
export function jpegOrientation(buf: ArrayBuffer): number {
  const view = new DataView(buf);
  if (view.byteLength < 4 || view.getUint16(0) !== 0xffd8) return 1;
  let offset = 2;
  while (offset + 4 < view.byteLength) {
    const marker = view.getUint16(offset);
    const size = view.getUint16(offset + 2);
    if (marker === 0xffe1 && offset + 10 <= view.byteLength && view.getUint32(offset + 4) === 0x45786966) {
      const tiff = offset + 10;
      const little = view.getUint16(tiff) === 0x4949;
      const ifd = tiff + view.getUint32(tiff + 4, little);
      if (ifd + 2 > view.byteLength) return 1;
      const entries = view.getUint16(ifd, little);
      for (let i = 0; i < entries; i++) {
        const entry = ifd + 2 + i * 12;
        if (entry + 10 > view.byteLength) break;
        if (view.getUint16(entry, little) === 0x0112) return view.getUint16(entry + 8, little);
      }
      return 1;
    }
    if ((marker & 0xff00) !== 0xff00) break;
    offset += 2 + size;
  }
  return 1;
}
