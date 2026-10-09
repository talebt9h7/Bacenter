import type { MetadataRoute } from 'next';
import { defaultSettings, getSettings } from '@/lib/settings';

export const dynamic = 'force-dynamic';

export default async function robots(): Promise<MetadataRoute.Robots> {
  // Avoid failing the production build when the database is unavailable.
  const settings = await getSettings().catch(() => defaultSettings);
  const base = (settings.canonicalBaseUrl || process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000').replace(/\/$/, '');
  return {
    rules: [{ userAgent: '*', allow: settings.seoIndex ? '/' : [], disallow: ['/admin/', '/api/', '/checkout', '/search'] }],
    sitemap: `${base}/sitemap.xml`,
  };
}
