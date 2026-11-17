import { asc, eq, gt } from 'drizzle-orm';
import { db } from '@/db';
import { categories, products, productVariants, settings } from '@/db/schema';
import { reservedByVariant } from './reservations';
import { defaultPriceList, normalizePriceList, type PriceListData, type PriceListRow, type PriceListSettings } from './wholesale-price-list';

export const PRICE_LIST_KEY = 'wholesalePriceList';

export async function getPriceListSettings(): Promise<PriceListSettings> {
  const [row] = await db.select({ value: settings.value }).from(settings).where(eq(settings.key, PRICE_LIST_KEY));
  return normalizePriceList(row?.value, defaultPriceList);
}

/** Products that have a wholesale price, grouped by category in the store's order, with each colour's photo. */
export async function getPriceListData(): Promise<PriceListData> {
  const [productRows, variantRows, categoryRows, reserved] = await Promise.all([
    db.select({ id: products.id, name: products.name, nameAr: products.nameAr, category: products.category, salePriceIqd: products.salePriceIqd, wholesalePriceIqd: products.wholesalePriceIqd, sortOrder: products.sortOrder, published: products.published })
      .from(products).where(gt(products.wholesalePriceIqd, 0)).orderBy(asc(products.sortOrder), asc(products.name)),
    db.select({ id: productVariants.id, productId: productVariants.productId, name: productVariants.name, nameAr: productVariants.nameAr, images: productVariants.images, primaryIndex: productVariants.primaryIndex, priceIqd: productVariants.priceIqd, sortOrder: productVariants.sortOrder, stock: productVariants.stock })
      .from(productVariants).orderBy(asc(productVariants.sortOrder), asc(productVariants.id)),
    db.select({ id: categories.id, name: categories.name, nameAr: categories.nameAr, sortOrder: categories.sortOrder }).from(categories).orderBy(asc(categories.sortOrder)),
    reservedByVariant(),
  ]);
  const available = (v: { id: number; stock: number }) => Math.max(0, v.stock - (reserved.get(v.id) ?? 0));
  const photo = (v: { images: string[]; primaryIndex: number }) => v.images[v.primaryIndex] ?? v.images[0] ?? null;
  const rows: PriceListRow[] = [], productLines: PriceListRow[] = [];
  for (const p of productRows.filter(p => p.published)) {
    const variants = variantRows.filter(v => v.productId === p.id);
    const nameAr = p.nameAr || p.name;
    productLines.push({ key: `p:${p.id}`, productKey: `p:${p.id}`, categoryId: p.category, nameAr, nameEn: p.name, image: variants.map(photo).find(Boolean) ?? null, wholesale: p.wholesalePriceIqd, retail: p.salePriceIqd, stock: variants.reduce((t, v) => t + available(v), 0) });
    for (const v of variants) {
      const colour = v.nameAr || v.name;
      rows.push({ key: `v:${v.id}`, productKey: `p:${p.id}`, categoryId: p.category, nameAr: variants.length > 1 && colour ? `${nameAr} ${colour}` : nameAr, nameEn: variants.length > 1 && v.name ? `${p.name} ${v.name}` : p.name, image: photo(v), wholesale: p.wholesalePriceIqd, retail: v.priceIqd ?? p.salePriceIqd, stock: available(v) });
    }
    if (!variants.length) rows.push(productLines[productLines.length - 1]);
  }
  const used = new Set(productLines.map(r => r.categoryId));
  const known = categoryRows.filter(c => used.has(c.id)).map(c => ({ id: c.id, title: c.nameAr || c.name }));
  const unknown = [...used].filter(id => !known.some(c => c.id === id)).map(id => ({ id, title: id }));
  return { categories: [...known, ...unknown], rows, productRows: productLines };
}
