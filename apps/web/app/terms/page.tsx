import type { Metadata } from 'next';
import { LegalPage } from '@/components/ui/LegalPage';
import { SITE } from '@/lib/site';

export const metadata: Metadata = { title: 'Terms of Service', alternates: { canonical: '/terms' } };

export default function TermsPage() {
  return (
    <LegalPage title="Terms of Service">
      <h2>1. Service</h2>
      <p>{SITE.name} provides online and desktop tools for working with PDF documents. Free features are provided with the usage limits shown on the pricing page.</p>
      <h2>2. Your content</h2>
      <p>You keep all rights to the documents you process. You confirm that you are entitled to process them, including any password-protected documents you unlock.</p>
      <h2>3. Acceptable use</h2>
      <ul>
        <li>No processing of unlawful content or content you have no rights to.</li>
        <li>No automated mass usage outside the official API.</li>
        <li>No attempts to circumvent usage limits or security measures.</li>
      </ul>
      <h2>4. Subscriptions</h2>
      <p>Paid plans renew automatically until cancelled. Cancellation takes effect at the end of the current billing period.</p>
      <h2>5. Liability</h2>
      <p>Always keep a copy of your original files. To the extent permitted by law, we are not liable for data loss or for results of automated processing such as OCR or translation.</p>
      <h2>6. Governing law</h2>
      <p>[Jurisdiction and governing law]</p>
    </LegalPage>
  );
}
