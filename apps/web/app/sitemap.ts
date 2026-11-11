import type { MetadataRoute } from 'next';
import { PDF_TOOLS } from '@/lib/tools-data';
import { SITE } from '@/lib/site';

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  const staticPages = ['', '/pricing', '/privacy', '/terms', '/imprint'].map((p) => ({
    url: `${SITE.url}${p}`,
    lastModified: now,
    changeFrequency: 'monthly' as const,
    priority: p === '' ? 1 : 0.4,
  }));
  const tools = PDF_TOOLS.map((t) => ({
    url: `${SITE.url}${t.path}`,
    lastModified: now,
    changeFrequency: 'weekly' as const,
    priority: t.popular ? 0.9 : 0.7,
  }));
  return [...staticPages, ...tools];
}
