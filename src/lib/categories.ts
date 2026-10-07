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
    if (!mapped.length) return legacyFallback();
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
