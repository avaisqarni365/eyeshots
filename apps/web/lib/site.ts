import type { Metadata } from 'next';
import { getTool, PROCESSING_LABEL } from './tools-data';

export const SITE = {
  name: 'EyeShots',
  url: (process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000').replace(/\/$/, ''),
  tagline: 'Privacy-first PDF tools',
  description:
    'Edit, convert, compress, merge and sign PDFs. Most tools run entirely in your browser — files that need our servers are deleted automatically within 2 hours.',
  supportEmail: process.env.NEXT_PUBLIC_SUPPORT_EMAIL || 'support@example.com',
};

/** Builds per-route SEO metadata for a tool from the registry. */
export function toolMetadata(id: string): Metadata {
  const tool = getTool(id);
  if (!tool) return {};
  const title = `${tool.name} — Free & Private`;
  return {
    title,
    description: tool.seoDescription,
    keywords: [tool.name, ...tool.keywords, 'PDF', PROCESSING_LABEL[tool.processing]],
    alternates: { canonical: tool.path },
    openGraph: { title: `${tool.name} | ${SITE.name}`, description: tool.seoDescription, url: tool.path, type: 'website' },
    twitter: { card: 'summary', title: `${tool.name} | ${SITE.name}`, description: tool.seoDescription },
  };
}
