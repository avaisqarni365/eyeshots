/**
 * EyeShots Genuine Document Visibility & Scan Enhancer
 * 
 * Enhances faded, dark, or shadowed document scans and camera photos
 * while preserving authentic handwriting, stamps, signatures, and paper texture.
 * 
 * Client-side execution (Zero server cost, 100% private).
 */

export interface VisibilitySettings {
  preset: 'magic' | 'ink' | 'sharp' | 'warm' | 'mono' | 'original' | 'custom';
  brightness: number; // 80 - 150 (Paper white / shadow clean)
  contrast: number;   // 100 - 220 (Ink depth / stroke clarity)
  sharpness: number;  // 0 - 100 (Edge micro-contrast)
  saturation: number; // 0 - 150 (Color preservation for stamps & seals)
  shadowClean: boolean; // Adaptive background normalization
}

export const VISIBILITY_PRESETS: Record<
  'magic' | 'ink' | 'sharp' | 'warm' | 'mono' | 'original',
  VisibilitySettings
> = {
  magic: {
    preset: 'magic',
    brightness: 114,
    contrast: 135,
    sharpness: 35,
    saturation: 105,
    shadowClean: true,
  },
  ink: {
    preset: 'ink',
    brightness: 106,
    contrast: 165,
    sharpness: 25,
    saturation: 90,
    shadowClean: true,
  },
  sharp: {
    preset: 'sharp',
    brightness: 110,
    contrast: 125,
    sharpness: 65,
    saturation: 100,
    shadowClean: true,
  },
  warm: {
    preset: 'warm',
    brightness: 103,
    contrast: 115,
    sharpness: 20,
    saturation: 110,
    shadowClean: false,
  },
  mono: {
    preset: 'mono',
    brightness: 118,
    contrast: 150,
    sharpness: 30,
    saturation: 0,
    shadowClean: true,
  },
  original: {
    preset: 'original',
    brightness: 100,
    contrast: 100,
    sharpness: 0,
    saturation: 100,
    shadowClean: false,
  },
};

/**
 * Returns hardware-accelerated CSS filter string for real-time canvas rendering.
 */
export function getVisibilityCssFilter(settings: VisibilitySettings): string {
  if (settings.preset === 'original') return 'none';

  const parts: string[] = [];

  if (settings.sharpness > 0) {
    parts.push('url(#genuine-sharpen)');
  }

  if (settings.brightness !== 100) {
    parts.push(`brightness(${settings.brightness}%)`);
  }

  if (settings.contrast !== 100) {
    parts.push(`contrast(${settings.contrast}%)`);
  }

  if (settings.saturation !== 100) {
    parts.push(`saturate(${settings.saturation}%)`);
  }

  return parts.length > 0 ? parts.join(' ') : 'none';
}

/**
 * Returns 2D canvas context filter string (supported in modern browsers).
 */
export function getCanvasContextFilter(settings: VisibilitySettings): string {
  if (settings.preset === 'original') return 'none';

  const parts: string[] = [];

  if (settings.brightness !== 100) {
    parts.push(`brightness(${settings.brightness}%)`);
  }

  if (settings.contrast !== 100) {
    parts.push(`contrast(${settings.contrast}%)`);
  }

  if (settings.saturation !== 100) {
    parts.push(`saturate(${settings.saturation}%)`);
  }

  return parts.length > 0 ? parts.join(' ') : 'none';
}

/**
 * High-quality 3x3 unsharp mask pixel processing for offscreen export when sharpness > 0.
 * Keeps genuine character curves while snapping blurry scans into focus.
 */
export function applySharpenFilter(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  strength: number
) {
  if (strength <= 0) return;
  const clampedStrength = Math.min(Math.max(strength / 100, 0), 1);
  const factor = clampedStrength * 0.5;

  try {
    const imgData = ctx.getImageData(0, 0, width, height);
    const data = imgData.data;
    const copy = new Uint8ClampedArray(data);

    // 3x3 Laplacian edge enhancement
    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        const idx = (y * width + x) * 4;
        for (let c = 0; c < 3; c++) {
          const center = copy[idx + c];
          const up = copy[((y - 1) * width + x) * 4 + c];
          const down = copy[((y + 1) * width + x) * 4 + c];
          const left = copy[(y * width + (x - 1)) * 4 + c];
          const right = copy[(y * width + (x + 1)) * 4 + c];

          // Edge delta
          const laplacian = 4 * center - up - down - left - right;
          const enhanced = center + laplacian * factor;
          data[idx + c] = Math.min(255, Math.max(0, enhanced));
        }
      }
    }
    ctx.putImageData(imgData, 0, 0);
  } catch (e) {
    // Canvas tainted or unsupported, graceful fallback
    console.warn('Canvas pixel sharpening skipped:', e);
  }
}
