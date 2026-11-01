import { PageKpis } from '@/components/admin/page-kpis';
import { pageStats } from '@/lib/admin-page-stats';
import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { normalizeLanguage, catalogT } from '@/lib/i18n';
import { requireAdminSection } from '@/lib/admin-auth';
import { getCategories } from '@/lib/categories';
import { getAllProducts } from '@/lib/products';
import { mediaSrc, primaryImage } from '@/lib/types';
import { CategoryManager } from '@/components/admin/category-manager';
export const metadata = { title: 'Categories' };
export const dynamic = 'force-dynamic';

export default async function CategoriesPage() {
  const language = normalizeLanguage((await cookies()).get('UR_lang')?.value);
  const actor = await requireAdminSection('catalog', 'view');
  if (!actor) redirect('/admin');
  const [categories, products] = await Promise.all([getCategories({ includeInactive: true }), getAllProducts({ includeUnpublished: true })]);
  // Per category: how many products (and how many are live), plus a product photo to show when the category has no image of its own.
  const rows = categories.map(c => {
    const own = products.filter(p => p.category === c.id);
    const withPhoto = own.find(p => p.colors.some(col => col.images.length));
    const cover = withPhoto ? primaryImage(withPhoto.colors.find(col => col.images.length)) : '';
    return { ...c, productCount: own.length, liveCount: own.filter(p => p.published).length, cover: cover ? mediaSrc(cover, 160) : '' };
  });
  return <main className="admin-page"><div className="admin-page-heading"><div><span className="admin-eyebrow">{catalogT('Catalog', language)}</span><h1>{catalogT('Categories', language)}</h1><p>{language === 'ar' ? 'رتّب أقسام المتجر بالسحب، شغّل أو أطفي ظهورها، وعدّل اسمها وصورتها ووصفها.' : 'Drag to reorder, switch visibility, and edit each category’s name, image and description.'}</p></div></div><PageKpis items={await pageStats('categories')} /><CategoryManager initial={rows} /></main>;
}
