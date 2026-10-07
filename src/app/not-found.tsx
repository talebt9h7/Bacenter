import Link from 'next/link';
import { ArrowRight, Compass } from 'lucide-react';
import { StoreProvider } from '@/components/store-provider';
import { getPublicSettings } from '@/lib/settings';
import { Header } from '@/components/header';
import { Footer } from '@/components/footer';
export default async function NotFound() { const settings = await getPublicSettings(); return <StoreProvider settings={settings}><Header /><main className="checkout-page"><div className="empty-cart"><Compass size={51} strokeWidth={1.1} /><h3>A little off the beaten path.</h3><p>We couldn’t find that page.<br />Let’s get you moving in the right direction.</p><Link href="/" className="button button-orange">Back to exploring <ArrowRight size={16} /></Link></div></main><Footer /></StoreProvider>; }
