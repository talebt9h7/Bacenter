import { PageKpis } from '@/components/admin/page-kpis';
import { pageStats } from '@/lib/admin-page-stats';
import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { normalizeLanguage, catalogT } from '@/lib/i18n';
import { requireAdminSection } from '@/lib/admin-auth';
import { asc } from 'drizzle-orm';
import { db } from '@/db';
import { categories as categoriesTable } from '@/db/schema';
import { getAllProducts } from '@/lib/products';
import { mediaSrc, primaryImage } from '@/lib/types';
import { CategoryManager } from '@/components/admin/category-manager';
export const metadata = { title: 'Categories' };
export const dynamic = 'force-dynamic';

export default async function CategoriesPage() {
  const language = normalizeLanguage((await cookies()).get('UR_lang')?.value);
  const actor = await requireAdminSection('catalog', 'view');
  if (!actor) redirect('/admin');
  const [all, products] = await Promise.all([db.select().from(categoriesTable).orderBy(asc(categoriesTable.sortOrder), asc(categoriesTable.name)), getAllProducts({ includeUnpublished: true })]);
  const plain = (c: typeof all[number]) => ({ ...c, nameAr: c.nameAr || c.name, createdAt: undefined, updatedAt: undefined });
  const categories = all.filter(c => c.id !== 'all').map(plain);
  const shopAllRow = all.find(c => c.id === 'all');
  const firstPhoto = products.find(p => p.colors.some(col => col.images.length));
  const shopAll = shopAllRow ? { ...plain(shopAllRow), productCount: products.length, liveCount: products.filter(p => p.published).length, cover: firstPhoto ? mediaSrc(primaryImage(firstPhoto.colors.find(col => col.images.length)), 160) : '' } : null;
  // Per category: how many products (and how many are live), plus a product photo to show when the category has no image of its own.
  const rows = categories.map(c => {
    const own = products.filter(p => p.category === c.id);
    const withPhoto = own.find(p => p.colors.some(col => col.images.length));
    const cover = withPhoto ? primaryImage(withPhoto.colors.find(col => col.images.length)) : '';
    return { ...c, productCount: own.length, liveCount: own.filter(p => p.published).length, cover: cover ? mediaSrc(cover, 160) : '' };
  });
  return <main className="admin-page"><div className="admin-page-heading"><div><span className="admin-eyebrow">{catalogT('Catalog', language)}</span><h1>{catalogT('Categories', language)}</h1><p>{language === 'ar' ? 'رتّب أقسام المتجر بالسحب، شغّل أو أطفي ظهورها، وعدّل اسمها وصورتها ووصفها.' : 'Drag to reorder, switch visibility, and edit each category’s name, image and description.'}</p></div></div><PageKpis items={await pageStats('categories')} /><CategoryManager initial={rows} shopAll={shopAll} /></main>;
}
