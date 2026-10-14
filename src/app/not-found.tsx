import Link from 'next/link';
import { ArrowRight, Compass } from 'lucide-react';
import { StoreProvider } from '@/components/store-provider';
import { getPublicSettings } from '@/lib/settings';
import { Header } from '@/components/header';
import { Footer } from '@/components/footer';
export default async function NotFound() { const settings = await getPublicSettings(); return <StoreProvider settings={settings}><Header /><main className="checkout-page"><div className="empty-cart"><Compass size={51} strokeWidth={1.1} /><h3>الصفحة غير موجودة</h3><p>الرابط اللي فتحته ما موجود أو انحذف.<br />The page you’re looking for isn’t here.</p><Link href="/" className="button button-orange">الرجوع للمتجر <ArrowRight size={16} /></Link></div></main><Footer /></StoreProvider>; }
