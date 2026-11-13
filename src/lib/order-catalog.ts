import { variantPriceSql, variantNameSql, variantNameArSql } from '@/lib/variant-sql';
import { reservedByVariant } from '@/lib/reservations';
import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { productVariants, products } from '@/db/schema';
import { getSettings } from '@/lib/settings';
import { roundIqd } from '@/lib/iraq';
export async function loadOrderCatalog() {
  const settings = await getSettings();
  const catalogRows = await db.select({ variantId: productVariants.id, productId: products.id, productName: products.name, productNameAr: products.nameAr, color: variantNameSql, colorAr: variantNameArSql, stock: productVariants.stock, priceCents: products.priceCents, salePriceIqd: variantPriceSql, image: productVariants.images, primaryIndex: productVariants.primaryIndex, published: products.published }).from(productVariants).innerJoin(products, eq(productVariants.productId, products.id)).orderBy(products.name, productVariants.sortOrder);
  const reserved = await reservedByVariant();
  // Products offered for manual orders show what can still be sold (on hand − pending reservations).
  const catalog = catalogRows.map(row => ({ ...row, stock: Math.max(0, row.stock - (reserved.get(row.variantId) ?? 0)), salePriceIqd: row.salePriceIqd || roundIqd(row.priceCents / 100 * settings.exchangeRate), image: row.image?.[row.primaryIndex] ?? row.image?.[0] ?? null }));
  return catalog;
}
