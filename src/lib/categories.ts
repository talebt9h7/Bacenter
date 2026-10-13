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
    const mapped = rows.map(map);
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
  // Exactly what the admin set: deleted or switched-off categories never show.
  const active = rows.map(map).filter(c => c.active);
  return [{ id: 'all', name: 'Shop all', nameAr: 'تسوق الكل' }, ...active.map(c => ({ id: c.id, name: c.name, nameAr: c.nameAr || c.name }))];
}
