import type { Metadata } from 'next';
import { LegalPage } from '@/components/ui/LegalPage';
import { SITE } from '@/lib/site';

export const metadata: Metadata = { title: 'Imprint', alternates: { canonical: '/imprint' } };

export default function ImprintPage() {
  return (
    <LegalPage title="Imprint">
      <p>Information pursuant to § 5 DDG (German Digital Services Act).</p>
      <h2>Provider</h2>
      <p>[Company name and legal form]<br />[Street and number]<br />[Postcode, City]<br />[Country]</p>
      <h2>Represented by</h2>
      <p>[Managing director(s)]</p>
      <h2>Contact</h2>
      <p>Email: {SITE.supportEmail}</p>
      <h2>Register entry</h2>
      <p>[Register court and registration number]</p>
      <h2>VAT ID</h2>
      <p>[VAT identification number according to § 27a UStG]</p>
    </LegalPage>
  );
}
