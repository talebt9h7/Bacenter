import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { cookies } from 'next/headers';
import { normalizeLanguage } from '@/lib/i18n';
import { infoPages } from '@/lib/info';
import { InfoPage } from '@/components/info-page';
import { getContentPage, getSettings } from '@/lib/settings';
import { getStoreLocations } from '@/lib/store-locations';

export const dynamic = 'force-dynamic';
type Props = { params: Promise<{ slug: string }> };
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const [page, settings, cookieStore] = await Promise.all([getContentPage(slug), getSettings(), cookies()]);
  const language = normalizeLanguage(cookieStore.get('bellroy_lang')?.value);
  const source = page || infoPages[slug];
  if (!source) return { title: 'Information', robots: { index: false, follow: false } };
  const title = language === 'ar' ? (source.titleAr || source.title || source.eyebrowAr || source.eyebrow || 'معلومات') : (source.title || source.eyebrow || 'Information');
  const description = language === 'ar' ? (source.subtitleAr || source.subtitle || source.eyebrowAr || source.eyebrow || settings.metaDescription) : (source.subtitle || source.eyebrow || settings.metaDescription);
  const image = source.image || settings.ogImage;
  const base = settings.canonicalBaseUrl?.replace(/\/$/, '');
  const url = base ? `${base}/info/${encodeURIComponent(slug)}` : undefined;
  return { title, description, alternates: url ? { canonical: url } : undefined, openGraph: { title, description, url, images: image ? [image] : undefined } };
}
export default async function InformationPage({ params }: Props) {
  const { slug } = await params;
  const stored = await getContentPage(slug);
  if (!stored && !infoPages[slug]) notFound();
  const cookieStore = await cookies();
  const language = normalizeLanguage(cookieStore.get('bellroy_lang')?.value);
  const page = stored ? { eyebrow: language === 'ar' ? (stored.eyebrowAr || stored.eyebrow) : stored.eyebrow, title: language === 'ar' ? (stored.titleAr || stored.title) : stored.title, subtitle: language === 'ar' ? (stored.subtitleAr || stored.subtitle) : stored.subtitle, image: stored.image ?? undefined, sections: language === 'ar' ? (stored.sectionsAr?.length ? stored.sectionsAr : stored.sections) : stored.sections, faqs: language === 'ar' ? (stored.faqsAr?.length ? stored.faqsAr : stored.faqs) : stored.faqs } : infoPages[slug];
  const stores = slug === 'stores' ? await getStoreLocations() : [];
  return <InfoPage slug={slug} page={page} stores={stores} />;
}
