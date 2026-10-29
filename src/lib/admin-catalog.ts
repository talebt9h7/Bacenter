import { variantPriceSql, variantNameSql, variantNameArSql } from '@/lib/variant-sql';
import { asc, eq } from 'drizzle-orm';
import { db } from '@/db';
import { productVariants, products } from '@/db/schema';
import { reservedByVariant } from './reservations';

/** Every product colour with what can still be sold, for admin pickers (bundles, wholesale). */
export type VariantOption = { variantId: number; productId: string; productName: string; productNameAr: string; color: string; colorAr: string; hex: string; available: number; salePriceIqd: number; wholesalePriceIqd: number; image: string | null; published: boolean; category: string };
export async function variantCatalog(): Promise<VariantOption[]> {
  const [rows, reserved] = await Promise.all([
    db.select({ variantId: productVariants.id, productId: products.id, productName: products.name, productNameAr: products.nameAr, color: variantNameSql, colorAr: variantNameArSql, hex: productVariants.hex, stock: productVariants.stock, salePriceIqd: variantPriceSql, wholesalePriceIqd: products.wholesalePriceIqd, images: productVariants.images, primaryIndex: productVariants.primaryIndex, published: products.published, category: products.category })
      .from(productVariants).innerJoin(products, eq(productVariants.productId, products.id)).orderBy(asc(products.name), asc(productVariants.id)),
    reservedByVariant(),
  ]);
  return rows.map(({ images, primaryIndex, stock, ...r }) => ({ ...r, available: Math.max(0, stock - (reserved.get(r.variantId) ?? 0)), image: images?.[primaryIndex] ?? images?.[0] ?? null }));
}
