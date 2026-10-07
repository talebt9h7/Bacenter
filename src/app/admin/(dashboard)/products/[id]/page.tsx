import { requireAdminSection } from '@/lib/admin-auth';
import { notFound, redirect } from 'next/navigation';
import { getProductById } from '@/lib/products';
import { getCategories } from '@/lib/categories';
import { getSettings } from '@/lib/settings';
import { ProductEditor } from '@/components/admin/product-editor';
import { ProductMovementLedger } from '@/components/admin/product-movement-ledger';
import { normalizeLanguage } from '@/lib/i18n';
import { cookies } from 'next/headers';

type Props = { params: Promise<{ id: string }>; searchParams: Promise<{ color?: string }> };
export async function generateMetadata({ params }: Props) { const { id } = await params; if (id === 'new') return { title: 'New product' }; const product = await getProductById(id, { includeUnpublished: true }); return { title: product ? `Edit ${product.name}` : 'Product' }; }
export default async function AdminProductPage({ params, searchParams }: Props) {
  const actor = await requireAdminSection('catalog', 'view');
  if (!actor) redirect('/admin');
  const { id } = await params; const { color } = await searchParams;
  const categories = await getCategories({ includeInactive: true });
  const settings = await getSettings();
  const exchangeRate = settings.exchangeRate;
  if (id === 'new') return <ProductEditor initial={null} exchangeRate={exchangeRate} categories={categories.map(c => ({ id: c.id, name: c.name }))} />;
  const product = await getProductById(id, { includeUnpublished: true });
  if (!product) notFound();
  const language = normalizeLanguage((await cookies()).get('bellroy_lang')?.value);
  return <><ProductEditor key={product.id} initial={product} initialColorId={color ? Number(color) : undefined} exchangeRate={exchangeRate} categories={categories.map(c => ({ id: c.id, name: c.name }))} /><ProductMovementLedger productId={product.id} language={language} /></>;
}
