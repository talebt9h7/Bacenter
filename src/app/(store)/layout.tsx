import type { ReactNode } from 'react';
import { StoreProvider } from '@/components/store-provider';
import { Header, CookieNotice } from '@/components/header';
import { Footer } from '@/components/footer';
import { getPublicSettings } from '@/lib/settings';

export const revalidate = 60;
export default async function StoreLayout({ children }: { children: ReactNode }) {
  const settings = await getPublicSettings();
  return <StoreProvider settings={settings}><a href="#main-content" className="skip-link">Skip to content</a><Header /><div id="main-content">{children}</div><Footer /><CookieNotice /></StoreProvider>;
}
