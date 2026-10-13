import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import Script from 'next/script';
import { cookies } from 'next/headers';
import { LanguageProvider } from '@/components/language-provider';
import { LANGUAGE_COOKIE, normalizeLanguage } from '@/lib/i18n';
import { defaultSettings, getSettings } from '@/lib/settings';
import './globals.css';
import './reference-refinements.css';
import './editorial.css';
import './admin.css';
import './admin-dashboard.css';
import './admin-theme.css';
import './typography.css';
import './cart-checkout.css';
import './product-card.css';

export async function generateMetadata(): Promise<Metadata> {
  const s = await getSettings().catch(() => defaultSettings);
  return {
    title: { default: s.metaTitle, template: `%s | ${s.storeName}` },
    description: s.metaDescription,
    metadataBase: (() => { try { return s.canonicalBaseUrl ? new URL(s.canonicalBaseUrl) : undefined; } catch { return undefined; } })(),
    alternates: s.canonicalBaseUrl ? { canonical: '/' } : undefined,
    openGraph: { title: s.metaTitle, description: s.metaDescription, images: s.ogImage ? [s.ogImage] : undefined, siteName: s.storeName },
    twitter: { card: 'summary_large_image', title: s.metaTitle, description: s.metaDescription, images: s.ogImage ? [s.ogImage] : undefined },
    icons: { icon: s.faviconUrl || s.logoUrl },
    robots: { index: s.seoIndex, follow: s.seoFollow },
  };
}
export default async function RootLayout({ children }: { children: ReactNode }) {
  const cookieStore = await cookies();
  const language = normalizeLanguage(cookieStore.get(LANGUAGE_COOKIE)?.value);
  return <html lang={language} dir={language === 'ar' ? 'rtl' : 'ltr'} data-scroll-behavior="smooth"><body><Script id="microsoft-clarity" strategy="afterInteractive">{`(function(c,l,a,r,i,t,y){c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);})(window, document, "clarity", "script", "yx1slmhyes");`}</Script><LanguageProvider initialLanguage={language}>{children}</LanguageProvider></body></html>;
}
