import { asc, eq } from 'drizzle-orm';
import { db } from '@/db';
import { categories } from '@/db/schema';
import { categories as legacyCategories } from '@/lib/catalog';

const legacyArabic: Record<string, string> = {
  backpacks: 'حقائب الظهر',
  'crossbody-bags': 'حقائب الكتف والكروس',
  'tote-bags': 'حقائب اليد والكتف',
  wallets: 'المحافظ',
  'phone-cases': 'أغطية الهواتف',
  luggage: 'حقائب السفر',
  'work-bags': 'حقائب العمل',
  accessories: 'إكسسوارات',
};

const legacyFallback = () => legacyCategories.filter(x => x.id !== 'all').map((x, i) => ({ id: x.id, name: x.name, nameAr: legacyArabic[x.id] || x.name, description: '', descriptionAr: '', image: null, active: true, sortOrder: i }));

export const ALL_ID = 'all';

export type Category = {
  id: string;
  name: string;
  nameAr: string;
  description: string;
  descriptionAr: string;
  image: string | null;
  active: boolean;
  sortOrder: number;
};

function map(row: typeof categories.$inferSelect): Category {
  return { id: row.id, name: row.name, nameAr: row.nameAr || row.name, description: row.description, descriptionAr: row.descriptionAr || row.description, image: row.image, active: row.active, sortOrder: row.sortOrder };
}

export async function getCategories(options: { includeInactive?: boolean } = {}): Promise<Category[]> {
  try {
    const rows = await db.select().from(categories).orderBy(asc(categories.sortOrder), asc(categories.name));
    // 'all' is the "Shop all" page, never a category a product can belong to.
    const mapped = rows.filter(r => r.id !== ALL_ID).map(map);
    return options.includeInactive ? mapped : mapped.filter(x => x.active);
  } catch {
    return legacyFallback();
  }
}

export async function getCategory(id: string) {
  try {
    const [row] = await db.select().from(categories).where(eq(categories.id, id)).limit(1);
    return row ? map(row) : null;
  } catch { return null; }
}

/**
 * Category links shown above product listings: "Shop all" + the active categories from
 * Admin → Categories, in their admin order. The built-in list is used only if the database can't be read.
 */
export async function getCatalogNav() {
  const { categories: builtIn } = await import('./catalog');
  let rows;
  try { rows = await db.select().from(categories).orderBy(asc(categories.sortOrder), asc(categories.name)); }
  catch { return builtIn.map(c => ({ id: c.id, name: c.name, nameAr: c.nameAr })); } // database unreachable only
  // Exactly what the admin set: deleted or switched-off categories never show. The "Shop all"
  // pill takes its label and visibility from the 'all' row (shown first when it is switched on).
  const all = rows.find(r => r.id === ALL_ID);
  const active = rows.filter(r => r.id !== ALL_ID).map(map).filter(c => c.active);
  const shopAll = !all ? [{ id: ALL_ID, name: 'Shop all', nameAr: 'تسوق الكل' }] : all.active ? [{ id: ALL_ID, name: all.name || 'Shop all', nameAr: all.nameAr || 'تسوق الكل' }] : [];
  return [...shopAll, ...active.map(c => ({ id: c.id, name: c.name, nameAr: c.nameAr || c.name }))];
}

export type CategoryPage = {
  eyebrow: string; eyebrowAr: string; headline: string; headlineAr: string; description: string; descriptionAr: string; image: string | null;
  banner: { image: string; mobileImage: string | null; title: string; titleAr: string; subtitle: string; subtitleAr: string; cta: string; ctaAr: string; href: string } | null;
};
/** The heading and banner for a category page ('all' included), as set in Admin → Categories. */
export async function getCategoryPage(id: string): Promise<(CategoryPage & { id: string; name: string; nameAr: string; active: boolean }) | null> {
  try {
    const [row] = await db.select().from(categories).where(eq(categories.id, id)).limit(1);
    if (!row) return null;
    return {
      id: row.id, name: row.name, nameAr: row.nameAr || row.name, active: row.active,
      eyebrow: row.eyebrow, eyebrowAr: row.eyebrowAr, headline: row.headline, headlineAr: row.headlineAr,
      description: row.description, descriptionAr: row.descriptionAr, image: row.image,
      banner: row.bannerActive && row.bannerImage ? { image: row.bannerImage, mobileImage: row.bannerMobileImage || null, title: row.bannerTitle, titleAr: row.bannerTitleAr, subtitle: row.bannerSubtitle, subtitleAr: row.bannerSubtitleAr, cta: row.bannerCta, ctaAr: row.bannerCtaAr, href: row.bannerHref } : null,
    };
  } catch { return null; }
}
