import { permanentRedirect } from 'next/navigation';

// Previously a duplicate of /forms (duplicate content hurts SEO). Keep old links working.
export default function GermanFormsRedirect() {
  permanentRedirect('/forms');
}
