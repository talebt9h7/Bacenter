import { sql } from 'drizzle-orm';
import { products, productVariants } from '@/db/schema';

/** Variant label for admin lists, reports and orders: "Brown · Large" for sized variants, else the colour. */
export const variantNameSql = sql<string>`CASE WHEN ${productVariants.size} <> '' THEN ${productVariants.name} || ' · ' || ${productVariants.size} ELSE ${productVariants.name} END`;
export const variantNameArSql = sql<string>`CASE WHEN ${productVariants.size} <> '' THEN COALESCE(NULLIF(${productVariants.nameAr}, ''), ${productVariants.name}) || ' · ' || COALESCE(NULLIF(${productVariants.sizeAr}, ''), ${productVariants.size}) ELSE ${productVariants.nameAr} END`;
/** The variant's own size price when set, otherwise the product price (IQD). */
export const variantPriceSql = sql<number>`COALESCE(${productVariants.priceIqd}, ${products.salePriceIqd})`;
