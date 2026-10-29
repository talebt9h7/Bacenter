import { cache } from 'react';
import { unstable_cache } from 'next/cache';
import { asc, eq, inArray } from 'drizzle-orm';
import { db } from '@/db';
import { products, productVariants } from '@/db/schema';
import { bagCategories } from './catalog';
import type { Product, ProductColor } from './types';
import { CATALOG_TAG } from './cache-tags';
import { detailsFromRow } from './product-details';
import { reservedByVariant } from './reservations';
import { applyPromotions, getUpcomingPromotions } from './promotions';

type ProductRow = typeof products.$inferSelect; type VariantRow = typeof productVariants.$inferSelect;
function toColor(row: VariantRow, reserved = 0): ProductColor { return { id: row.id, name: row.name, nameAr: row.nameAr || row.name, hex: row.hex, stock: Math.max(0, row.stock - reserved), onHand: row.stock, reserved, images: row.images ?? [], primaryIndex: Math.min(row.primaryIndex, Math.max((row.images?.length ?? 1) - 1, 0)), size: row.size || '', sizeAr: row.sizeAr || row.size || '', priceIqd: row.priceIqd ?? null }; }
function toProduct(row: ProductRow, variants: VariantRow[], reserved: Map<number, number>): Product {
  return { id: row.id, name: row.name, nameAr: row.nameAr || row.name, subtitle: row.subtitle, subtitleAr: row.subtitleAr || row.subtitle, description: row.description, descriptionAr: row.descriptionAr || row.description, price: row.priceCents / 100, salePriceIqd: row.salePriceIqd || Math.round((row.priceCents / 100) * 1320), category: row.category, capacity: row.capacity, badge: row.badge, features: row.features ?? [], specifications: row.specifications ?? [], warranty: row.warranty ?? '', materials: row.materials ?? '', storyImages: row.storyImages ?? [], dimensions: row.dimensions, dimensionsImage: row.dimensionsImage ?? '', tags: row.tags ?? [], published: row.published, colors: variants.map(variant => toColor(variant, reserved.get(variant.id) ?? 0)), details: detailsFromRow(row) };
}
async function attachVariants(rows: ProductRow[]) {
  if (!rows.length) return [];
  const [variants, reserved] = await Promise.all([
    db.select().from(productVariants).where(inArray(productVariants.productId, rows.map(row => row.id))).orderBy(asc(productVariants.sortOrder), asc(productVariants.id)),
    reservedByVariant(),
  ]);
  return rows.map(row => toProduct(row, variants.filter(variant => variant.productId === row.id), reserved));
}
async function loadAllProducts() {
  const rows = await db.select().from(products).orderBy(asc(products.sortOrder), asc(products.createdAt));
  return attachVariants(rows);
}
async function loadProduct(id: string) {
  const rows = await db.select().from(products).where(eq(products.id, id)).limit(1);
  if (!rows.length) return null;
  const [product] = await attachVariants(rows);
  return product;
}
// Storefront reads are shared across requests and cleared by invalidateCatalog()
// whenever products, stock or orders change. Admin reads (includeUnpublished) stay live.
const cachedAllProducts = unstable_cache(loadAllProducts, ['catalog-all-products-v1'], { revalidate: 60, tags: [CATALOG_TAG] });
const cachedProduct = unstable_cache(loadProduct, ['catalog-product-v1'], { revalidate: 60, tags: [CATALOG_TAG] });
const isVisible = (product: Product) => product.published && product.colors.length > 0;

export const getAllProducts = cache(async function getAllProducts({ includeUnpublished = false } = {}) {
  if (includeUnpublished) return loadAllProducts();
  // Promotions are applied after the cache so they start and end on time.
  const [list, promos] = await Promise.all([cachedAllProducts(), getUpcomingPromotions()]);
  return applyPromotions(list.filter(isVisible), promos);
});
export const getProductById = cache(async function getProductById(id: string, { includeUnpublished = false } = {}) {
  if (includeUnpublished) return loadProduct(id);
  const [product, promos] = await Promise.all([cachedProduct(id), getUpcomingPromotions()]);
  return product && isVisible(product) ? applyPromotions([product], promos)[0] : null;
});
export async function getProductsFor(category?: string, collection?: string) {
  let result = await getAllProducts();
  if (category === 'bags') result = result.filter(product => bagCategories.includes(product.category));
  else if (category && category !== 'all') result = result.filter(product => product.category === category);
  if (collection) { const filtered = result.filter(product => product.tags.includes(collection)); result = filtered.length ? filtered : result; }
  return result;
}
/** `extra` adds searchable text such as the category's English and Arabic names. */
export function matchesQuery(product: Product, query: string, extra = '') {
  const haystack = [extra, product.name, product.nameAr, product.subtitle, product.subtitleAr, product.description, product.descriptionAr, product.category, ...product.tags, ...product.colors.flatMap(color => [color.name, color.nameAr])].join(' ').toLowerCase();
  return haystack.includes(query.toLowerCase());
}
