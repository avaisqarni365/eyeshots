import { ToolPageShell } from '@/components/ui/ToolPageShell';
import { ImagesToPdfTool } from '@/components/tools/ImagesToPdfTool';
import { toolMetadata } from '@/lib/site';

export const metadata = toolMetadata('jpg-to-pdf');

const STEPS = [
  "Drop one or more images \u2014 JPG, PNG, WebP, GIF or BMP.",
  "Drag thumbnails to set the page order and choose page size, orientation and margins.",
  "Click Convert to PDF. Everything happens in your browser."
];

const FAQ = [
  {
    "q": "Is image quality reduced?",
    "a": "JPG files are embedded as-is without re-compression. Other formats are converted losslessly to PNG."
  },
  {
    "q": "Are phone photos rotated correctly?",
    "a": "Yes. EXIF orientation from your camera is respected automatically."
  }
];

export default function Page() {
  return (
    <ToolPageShell toolId="jpg-to-pdf" steps={STEPS} faq={FAQ}>
      <ImagesToPdfTool />
    </ToolPageShell>
  );
}
