import { getCatalogNav, getCategories } from '@/lib/categories';
import { CatalogView } from '@/components/catalog-view';
import { getAllProducts, matchesQuery } from '@/lib/products';
import { cookies } from 'next/headers';
import { normalizeLanguage } from '@/lib/i18n';
export const metadata = { title: 'Search' };
export const dynamic = 'force-dynamic';
export default async function SearchPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q = '' } = await searchParams;
  const query = q.trim().slice(0, 100);
  const [all, cats] = await Promise.all([getAllProducts(), query ? getCategories() : Promise.resolve([])]);
  const categoryText = new Map(cats.map(c => [c.id, `${c.name} ${c.nameAr}`]));
  const found = query ? all.filter(product => matchesQuery(product, query, categoryText.get(product.category))) : all;
  const language = normalizeLanguage((await cookies()).get('bellroy_lang')?.value);
  const title = query ? `Results for “${query}”` : 'Find your next companion';
  const titleAr = query ? `نتائج البحث عن «${query}»` : 'اعثر على ما يناسبك';
  const description = query ? `${found.length} thoughtfully designed products, ready to go wherever you do.` : 'A little less searching. A little more possibility. Explore our considered carry collection.';
  const descriptionAr = query ? `${found.length} منتجات مصممة بعناية، جاهزة لمرافقتك أينما ذهبت.` : 'بحث أقل، خيارات أكثر. اكتشف مجموعة مصممة بعناية لكل يوم.';
  return <CatalogView navCategories={await getCatalogNav()} products={found} title={title} titleAr={titleAr} description={description} descriptionAr={descriptionAr} searchQuery={query} />;
}
