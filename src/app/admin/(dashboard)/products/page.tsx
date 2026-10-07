import { redirect } from 'next/navigation';
import { requireAdminSection } from '@/lib/admin-auth';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { getAllProducts } from '@/lib/products';
import { getCategories } from '@/lib/categories';
import { primaryImage, totalStock } from '@/lib/types';
import { ProductTable } from '@/components/admin/product-table';
import { ProductsPageHeader } from '@/components/admin/products-page-header';

export const metadata = { title: 'Products' };
export default async function AdminProductsPage() {
  const actor = await requireAdminSection('catalog', 'view');
  if (!actor) redirect('/admin');
  const products = await getAllProducts({ includeUnpublished: true });
  const categories = await getCategories({ includeInactive: true });
  const rows = products.map(product => ({ id: product.id, name: product.name, image: primaryImage(product.colors[0]), category: categories.find(item => item.id === product.category)?.name ?? product.category, price: product.salePriceIqd, published: product.published, stock: totalStock(product), colors: product.colors.map(color => ({ id: color.id, name: color.name, hex: color.hex, stock: color.stock, photos: color.images.length })) }));
  return <main className="admin-page"><ProductsPageHeader /><ProductTable rows={rows} /><p className="admin-footnote">Tip: the storefront switches colors while keeping the same photo position, so keep each color’s photos in the same order (front, detail, side…). <Link className="admin-link" href="/" target="_blank">Open storefront <ArrowRight size={13} /></Link></p></main>;
}
