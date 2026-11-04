import { Suspense, type ReactNode } from 'react';
import { StoreProvider } from '@/components/store-provider';
import { Header } from '@/components/header';
import { Footer } from '@/components/footer';
import { Tracking } from '@/components/tracking';
import { SpeedInsights } from '@vercel/speed-insights/next';
import { getPublicSettings } from '@/lib/settings';
import { getPublicTracking } from '@/lib/integrations';

export const revalidate = 60;
export default async function StoreLayout({ children }: { children: ReactNode }) {
  const [settings, tracking] = await Promise.all([getPublicSettings(), getPublicTracking()]);
  return <StoreProvider settings={settings}><a href="#main-content" className="skip-link">تخطَّ إلى المحتوى</a><Header /><div id="main-content">{children}</div><Footer /><Suspense fallback={null}><Tracking ids={tracking} /></Suspense>{/* Real-user speed numbers (LCP, INP, CLS) from shoppers' own phones, in Vercel → Speed Insights. */}<SpeedInsights /></StoreProvider>;
}
