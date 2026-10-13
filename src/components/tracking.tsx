'use client';

import Script from 'next/script';
import { useEffect, useRef } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import type { PublicTracking } from '@/lib/integrations';

/** Installs Meta Pixel, Google Analytics 4 and Microsoft Clarity when their IDs are set in the admin. */
export function Tracking({ ids }: { ids: PublicTracking }) {
  const pathname = usePathname();
  const search = useSearchParams();
  const first = useRef(true);
  // The pixel's base code sends the first PageView; later client-side navigations send their own.
  // (GA4 tracks history changes itself; Clarity records the whole session.)
  useEffect(() => {
    if (first.current) { first.current = false; return; }
    const win = window as Window & { fbq?: (...args: unknown[]) => void };
    try { win.fbq?.('track', 'PageView'); } catch { /* blocked */ }
  }, [pathname, search]);
  return <>
    {ids.metaPixelId && <Script id="meta-pixel" strategy="afterInteractive">{`!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');fbq('init','${ids.metaPixelId}');fbq('track','PageView');`}</Script>}
    {ids.ga4Id && <>
      <Script src={`https://www.googletagmanager.com/gtag/js?id=${ids.ga4Id}`} strategy="afterInteractive" />
      <Script id="ga4" strategy="afterInteractive">{`window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}window.gtag=gtag;gtag('js',new Date());gtag('config','${ids.ga4Id}',{currency:'IQD'});`}</Script>
    </>}
    {ids.clarityId && <Script id="ms-clarity" strategy="afterInteractive">{`(function(c,l,a,r,i,t,y){c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);})(window,document,"clarity","script","${ids.clarityId}");`}</Script>}
  </>;
}
