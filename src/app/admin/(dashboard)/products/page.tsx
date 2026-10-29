import { priceFrom, variantLabel } from '@/lib/variants';
import { redirect } from 'next/navigation';
import { requireAdminSection } from '@/lib/admin-auth';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { getAllProducts } from '@/lib/products';
import { getCategories } from '@/lib/categories';
import { primaryImage, totalStock } from '@/lib/types';
import { ProductTable } from '@/components/admin/product-table';
import { ProductsPageHeader } from '@/components/admin/products-page-header';
import { getSettings } from '@/lib/settings';
import { stockLevel } from '@/lib/stock-level';

export const metadata = { title: 'Products' };
export default async function AdminProductsPage() {
  const actor = await requireAdminSection('catalog', 'view');
  if (!actor) redirect('/admin');
  const products = await getAllProducts({ includeUnpublished: true });
  const categories = await getCategories({ includeInactive: true });
  const rows = products.map(product => ({ id: product.id, name: product.name, image: primaryImage(product.colors[0]), category: categories.find(item => item.id === product.category)?.name ?? product.category, categoryId: product.category, price: priceFrom(product).min, published: product.published, stock: totalStock(product), colors: product.colors.map(color => ({ id: color.id, name: variantLabel(color.name, color.size), hex: color.hex, stock: color.stock, photos: color.images.length })) }));
  const { lowStockThreshold } = await getSettings();
  const colors = products.flatMap(p => p.colors);
  const stats = { products: products.length, published: products.filter(p => p.published).length, colors: colors.length, soldOut: colors.filter(c => stockLevel(c.stock, lowStockThreshold) === 'out').length, low: colors.filter(c => stockLevel(c.stock, lowStockThreshold) === 'low').length, noPhotos: colors.filter(c => !c.images.length).length, units: colors.reduce((s, c) => s + c.stock, 0), lowThreshold: lowStockThreshold };
  return <main className="admin-page dash"><ProductsPageHeader stats={stats} /><ProductTable rows={rows} lowStockThreshold={lowStockThreshold} categories={categories.map(c => ({ id: c.id, name: c.name, nameAr: c.nameAr }))} /><p className="admin-footnote">Tip: the storefront switches colors while keeping the same photo position, so keep each color’s photos in the same order (front, detail, side…). <Link className="admin-link" href="/" target="_blank">Open storefront <ArrowRight size={13} /></Link></p></main>;
}
