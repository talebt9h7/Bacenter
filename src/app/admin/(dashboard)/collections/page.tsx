import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { normalizeLanguage, catalogT } from '@/lib/i18n';
import { requireAdminSection } from '@/lib/admin-auth';
import { CollectionsManager } from '@/components/admin/collections-manager';
import { getAllProducts } from '@/lib/products';
import { getSettings } from '@/lib/settings';

export const metadata = { title: 'Collections' };
export const dynamic = 'force-dynamic';

export default async function AdminCollectionsPage() {
  const language = normalizeLanguage((await cookies()).get('UR_lang')?.value);
  const actor = await requireAdminSection('catalog', 'view');
  if (!actor) redirect('/admin');
  const [settings, products] = await Promise.all([getSettings(), getAllProducts({ includeUnpublished: true })]);
  const productRows = products.map(product => ({ id: product.id, name: product.name, category: product.category, price: product.price }));
  return <main className="admin-page"><div className="admin-page-heading"><div><span className="admin-eyebrow">{catalogT('Catalog', language)}</span><h1>{catalogT('Collections', language)}</h1><p>{catalogT('Manage collection landing pages and choose exactly which products belong to each collection.', language)}</p></div></div><CollectionsManager initial={settings.homepage.collections} products={productRows} /></main>;
}
