import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { normalizeLanguage, catalogT } from '@/lib/i18n';
import { requireAdminSection } from '@/lib/admin-auth';
import { getCategories } from '@/lib/categories';
import { CategoryManager } from '@/components/admin/category-manager';
export const metadata = { title: 'Categories' };
export default async function CategoriesPage() {
  const language = normalizeLanguage((await cookies()).get('UR_lang')?.value);
  const actor = await requireAdminSection('catalog', 'view');
  if (!actor) redirect('/admin');
  return <main className="admin-page"><div className="admin-page-heading"><div><span className="admin-eyebrow">{catalogT('Catalog', language)}</span><h1>{catalogT('Categories', language)}</h1><p>{catalogT('Manage real product categories, their slugs, visibility and storefront details.', language)}</p></div></div><CategoryManager initial={await getCategories({ includeInactive: true })} /></main>;
}
