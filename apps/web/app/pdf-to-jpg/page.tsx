import { ToolPageShell } from '@/components/ui/ToolPageShell';
import { PdfToImagesTool } from '@/components/tools/PdfToImagesTool';
import { toolMetadata } from '@/lib/site';

export const metadata = toolMetadata('pdf-to-jpg');

const STEPS = [
  "Drop a PDF into the box above.",
  "Choose JPG or PNG, a resolution and optionally which pages to export.",
  "Download a single image or a ZIP with one image per page."
];

const FAQ = [
  {
    "q": "Which resolution should I choose?",
    "a": "Screen (72 DPI) for previews, Standard (150 DPI) for sharing, and Print (300 DPI) for printing or OCR."
  },
  {
    "q": "Is my PDF uploaded?",
    "a": "No. Pages are rendered locally with PDF.js; the file never leaves your device."
  }
];

export default function Page() {
  return (
    <ToolPageShell toolId="pdf-to-jpg" steps={STEPS} faq={FAQ}>
      <PdfToImagesTool />
    </ToolPageShell>
  );
}
