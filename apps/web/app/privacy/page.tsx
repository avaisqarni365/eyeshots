import type { Metadata } from 'next';
import { LegalPage } from '@/components/ui/LegalPage';
import { SITE } from '@/lib/site';

export const metadata: Metadata = { title: 'Privacy Policy', alternates: { canonical: '/privacy' } };

export default function PrivacyPage() {
  return (
    <LegalPage title="Privacy Policy">
      <h2>1. Our approach</h2>
      <p>
        {SITE.name} is designed so that we see as little of your data as possible. Most tools — merge, split, rotate, crop, delete
        pages, watermark, page numbers, image conversion, editing and comparison — run entirely in your browser. Files used with
        these tools are never transmitted to us.
      </p>
      <h2>2. Files processed on our servers</h2>
      <p>Some tasks require server-side processing: OCR, Office-to-PDF and PDF-to-Word conversion, compression, password protection and unlocking. For these tasks:</p>
      <ul>
        <li>Files are transferred over an encrypted (TLS) connection.</li>
        <li>Files are processed in memory or in ephemeral storage and deleted automatically no later than 2 hours after upload.</li>
        <li>We do not inspect, index or share your documents, and we do not use them to train models.</li>
        <li>Passwords you enter to protect or unlock a PDF are used only for that single operation and are never stored.</li>
      </ul>
      <h2>3. Data we collect</h2>
      <ul>
        <li>Technical logs (IP address, timestamp, tool used, file size — never file contents), kept for up to 14 days for security and abuse prevention.</li>
        <li>Account and billing data if you subscribe to a paid plan, processed by our payment provider.</li>
        <li>Preferences such as your colour theme, stored only in your browser.</li>
      </ul>
      <h2>4. Legal basis (GDPR)</h2>
      <p>We process data to provide the service you request (Art. 6(1)(b) GDPR) and for our legitimate interest in operating a secure service (Art. 6(1)(f) GDPR).</p>
      <h2>5. Your rights</h2>
      <p>
        You have the right to access, rectify, erase, restrict and port your data, and to object to processing. You may also lodge a
        complaint with a supervisory authority. Contact: {SITE.supportEmail}.
      </p>
      <h2>6. Controller</h2>
      <p>[Company name, address — see Imprint]</p>
    </LegalPage>
  );
}
