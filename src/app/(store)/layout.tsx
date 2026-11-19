import { Suspense, type ReactNode } from 'react';
import { StoreProvider } from '@/components/store-provider';
import { Header } from '@/components/header';
import { Footer } from '@/components/footer';
import { Tracking } from '@/components/tracking';
import { SpeedInsights } from '@vercel/speed-insights/next';
import { getPublicSettings } from '@/lib/settings';
import { getPublicTracking } from '@/lib/integrations';
import { getUpcomingPromotions } from '@/lib/promotions';
import { PromoBar } from '@/components/promo-bar';

export const revalidate = 60;
/** Offers for the strip above the header, with the time they were read (the strip picks the live one before the browser clock starts). */
async function loadPromoBar() { const promos = await getUpcomingPromotions(); return { promos, at: Date.now() }; }
export default async function StoreLayout({ children }: { children: ReactNode }) {
  const [settings, tracking, promoBar] = await Promise.all([getPublicSettings(), getPublicTracking(), loadPromoBar()]);
  return <StoreProvider settings={settings}><a href="#main-content" className="skip-link">تخطَّ إلى المحتوى</a><PromoBar promos={promoBar.promos} renderedAt={promoBar.at} /><Header /><div id="main-content">{children}</div><Footer /><Suspense fallback={null}><Tracking ids={tracking} /></Suspense>{/* Real-user speed numbers (LCP, INP, CLS) from shoppers' own phones, in Vercel → Speed Insights. */}<SpeedInsights /></StoreProvider>;
}
