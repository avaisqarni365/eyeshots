import { ToolPageShell } from '@/components/ui/ToolPageShell';
import { CropTool } from '@/components/tools/CropTool';
import { toolMetadata } from '@/lib/site';

export const metadata = toolMetadata('crop-pdf');

const STEPS = [
  "Drop your PDF into the box above.",
  "Choose Auto-trim to remove white margins on every page, or set exact margins manually.",
  "Click Crop & download. The file is processed locally and never uploaded."
];

const FAQ = [
  {
    "q": "Does cropping delete the content outside the area?",
    "a": "No. Cropping changes the visible page area (CropBox). The content outside it is hidden, not removed, so it is not a secure redaction."
  },
  {
    "q": "Does Auto-trim work on scanned documents?",
    "a": "Yes. Each page is rendered and analysed for non-white content, so it works on both digital and scanned PDFs."
  }
];

export default function Page() {
  return (
    <ToolPageShell toolId="crop-pdf" steps={STEPS} faq={FAQ}>
      <CropTool />
    </ToolPageShell>
  );
}
