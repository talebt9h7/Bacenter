import { asc, count, eq, inArray, sql } from 'drizzle-orm';
import { db } from '@/db';
import { products, productVariants } from '@/db/schema';
import { bagCategories, seedProducts } from './catalog';
import type { Product, ProductColor } from './types';

let schemaReady: Promise<void> | null = null;
async function ensureProductsSchema() {
  if (!schemaReady) schemaReady = (async () => {
    await db.execute(sql.raw(`
    ALTER TABLE public.products
      ADD COLUMN IF NOT EXISTS name_ar text NOT NULL DEFAULT '',
      ADD COLUMN IF NOT EXISTS subtitle text NOT NULL DEFAULT '',
      ADD COLUMN IF NOT EXISTS subtitle_ar text NOT NULL DEFAULT '',
      ADD COLUMN IF NOT EXISTS description text NOT NULL DEFAULT '',
      ADD COLUMN IF NOT EXISTS description_ar text NOT NULL DEFAULT '',
      ADD COLUMN IF NOT EXISTS price_cents integer NOT NULL DEFAULT 0,
      ADD COLUMN IF NOT EXISTS sale_price_iqd integer NOT NULL DEFAULT 0,
      ADD COLUMN IF NOT EXISTS category text NOT NULL DEFAULT '',
      ADD COLUMN IF NOT EXISTS capacity text,
      ADD COLUMN IF NOT EXISTS badge text,
      ADD COLUMN IF NOT EXISTS badge_ar text,
      ADD COLUMN IF NOT EXISTS features jsonb NOT NULL DEFAULT '[]'::jsonb,
      ADD COLUMN IF NOT EXISTS dimensions text NOT NULL DEFAULT '',
      ADD COLUMN IF NOT EXISTS tags jsonb NOT NULL DEFAULT '[]'::jsonb,
      ADD COLUMN IF NOT EXISTS published boolean NOT NULL DEFAULT true,
      ADD COLUMN IF NOT EXISTS sort_order integer NOT NULL DEFAULT 0,
      ADD COLUMN IF NOT EXISTS created_at timestamp NOT NULL DEFAULT now(),
      ADD COLUMN IF NOT EXISTS updated_at timestamp NOT NULL DEFAULT now();
    ALTER TABLE public.product_variants
      ADD COLUMN IF NOT EXISTS name_ar text NOT NULL DEFAULT '',
      ADD COLUMN IF NOT EXISTS hex text NOT NULL DEFAULT '#333333',
      ADD COLUMN IF NOT EXISTS stock integer NOT NULL DEFAULT 0,
      ADD COLUMN IF NOT EXISTS images jsonb NOT NULL DEFAULT '[]'::jsonb,
      ADD COLUMN IF NOT EXISTS primary_index integer NOT NULL DEFAULT 0,
      ADD COLUMN IF NOT EXISTS sort_order integer NOT NULL DEFAULT 0;
  `));
  })();
  return schemaReady;
}
let seeding: Promise<void> | null = null;
export async function ensureSeeded() {
  if (!seeding) seeding = (async () => {
    const [{ total }] = await db.select({ total: count() }).from(products);
    if (total > 0) return;
    await db.transaction(async tx => {
      for (const [index, seed] of seedProducts.entries()) {
        await tx.insert(products).values({ id: seed.id, name: seed.name, subtitle: seed.subtitle, description: seed.description, priceCents: Math.round(seed.price * 100), salePriceIqd: Math.round(seed.price * 1320), category: seed.category, capacity: seed.capacity ?? null, badge: seed.badge ?? null, features: seed.features, dimensions: seed.dimensions, tags: seed.tags, sortOrder: index }).onConflictDoNothing();
        await tx.insert(productVariants).values(seed.colors.map((color, order) => ({ productId: seed.id, name: color.name, hex: color.hex, stock: color.stock, images: color.images, primaryIndex: 0, sortOrder: order })));
      }
    });
  })().catch(error => { seeding = null; throw error; });
  return seeding;
}
type ProductRow = typeof products.$inferSelect; type VariantRow = typeof productVariants.$inferSelect;
function toColor(row: VariantRow): ProductColor { return { id: row.id, name: row.name, nameAr: row.nameAr || row.name, hex: row.hex, stock: row.stock, images: row.images ?? [], primaryIndex: Math.min(row.primaryIndex, Math.max((row.images?.length ?? 1) - 1, 0)) }; }
function toProduct(row: ProductRow, variants: VariantRow[]): Product {
  return { id: row.id, name: row.name, nameAr: row.nameAr || row.name, subtitle: row.subtitle, subtitleAr: row.subtitleAr || row.subtitle, description: row.description, descriptionAr: row.descriptionAr || row.description, price: row.priceCents / 100, salePriceIqd: row.salePriceIqd || Math.round((row.priceCents / 100) * 1320), category: row.category, capacity: row.capacity, badge: row.badge, features: row.features ?? [], dimensions: row.dimensions, tags: row.tags ?? [], published: row.published, colors: variants.map(toColor) };
}
async function attachVariants(rows: ProductRow[]) {
  if (!rows.length) return [];
  const variants = await db.select().from(productVariants).where(inArray(productVariants.productId, rows.map(row => row.id))).orderBy(asc(productVariants.sortOrder), asc(productVariants.id));
  return rows.map(row => toProduct(row, variants.filter(variant => variant.productId === row.id)));
}
export async function getAllProducts({ includeUnpublished = false } = {}) {
  await ensureSeeded();
  const rows = await db.select().from(products).orderBy(asc(products.sortOrder), asc(products.createdAt));
  const list = await attachVariants(rows);
  return includeUnpublished ? list : list.filter(product => product.published && product.colors.length > 0);
}
export async function getProductById(id: string, { includeUnpublished = false } = {}) {
  await ensureSeeded();
  const rows = await db.select().from(products).where(eq(products.id, id)).limit(1);
  if (!rows.length) return null;
  const [product] = await attachVariants(rows);
  if (!includeUnpublished && (!product.published || !product.colors.length)) return null;
  return product;
}
export async function getProductsFor(category?: string, collection?: string) {
  let result = await getAllProducts();
  if (category === 'bags') result = result.filter(product => bagCategories.includes(product.category));
  else if (category && category !== 'all') result = result.filter(product => product.category === category);
  if (collection) { const filtered = result.filter(product => product.tags.includes(collection)); result = filtered.length ? filtered : result; }
  return result;
}
export function matchesQuery(product: Product, query: string) {
  const haystack = [product.name, product.nameAr, product.subtitle, product.subtitleAr, product.description, product.descriptionAr, product.category, ...product.tags, ...product.colors.flatMap(color => [color.name, color.nameAr])].join(' ').toLowerCase();
  return haystack.includes(query.toLowerCase());
}
