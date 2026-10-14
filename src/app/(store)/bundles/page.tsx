import type { Metadata } from 'next';
import { getStoreBundles } from '@/lib/bundles';
import { BundlesSection } from '@/components/bundle-card';

export const revalidate = 60;
export const metadata: Metadata = { title: 'البكجات | Bundles' };
export default async function BundlesPage() {
  const bundles = await getStoreBundles();
  return <main className="bundles-page">{bundles.length ? <BundlesSection bundles={bundles} /> : <p className="bundles-empty">لا توجد بكجات حالياً.</p>}</main>;
}
