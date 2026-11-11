import { ToolPageShell } from '@/components/ui/ToolPageShell';
import { OfficeToPdfTool } from '@/components/tools/OfficeToPdfTool';
import { toolMetadata } from '@/lib/site';

export const metadata = toolMetadata('powerpoint-to-pdf');

const STEPS = [
  "Drop your PowerPoint file into the box above.",
  "We convert it with LibreOffice on an isolated, ephemeral worker.",
  "Download your PDF. The uploaded file is deleted automatically within 2 hours."
];

const FAQ = [
  {
    "q": "Why does this tool upload my file?",
    "a": "Office formats need a full office suite to render accurately, which cannot run in a browser. The file is sent over an encrypted connection, converted, and deleted automatically within 2 hours."
  },
  {
    "q": "Will fonts and layout be preserved?",
    "a": "Layout, tables and images are preserved. Uncommon fonts that are not embedded in the document may be substituted with metric-compatible alternatives."
  }
];

export default function Page() {
  return (
    <ToolPageShell toolId="powerpoint-to-pdf" steps={STEPS} faq={FAQ}>
      <OfficeToPdfTool accept=".pptx,.ppt,.odp" kind="PowerPoint" />
    </ToolPageShell>
  );
}
