import { asc, eq, inArray } from 'drizzle-orm';
import { unstable_cache } from 'next/cache';
import { db } from '@/db';
import { bundles, productVariants, products, type BundleItem } from '@/db/schema';
import { CATALOG_TAG } from './cache-tags';
import { reservedByVariant } from './reservations';

/**
 * Bundles ("بكج"): two or more product colours sold together at one price set in the admin.
 * At checkout each component becomes its own order line (so stock, cost and profit work exactly
 * like single sales); the bundle price is split across the lines in proportion to their regular
 * prices, and every line keeps the bundle's id and name.
 */
export type BundlePart = { variantId: number; quantity: number; productId: string; name: string; nameAr: string; color: string; colorAr: string; hex: string; image: string | null; priceIqd: number; available: number; published: boolean };
export type BundleView = { id: number; slug: string; name: string; nameAr: string; description: string; descriptionAr: string; image: string | null; priceIqd: number; regularIqd: number; savingIqd: number; active: boolean; sortOrder: number; parts: BundlePart[]; available: number };

type Row = typeof bundles.$inferSelect;
type Executor = Pick<typeof db, 'select'>;
async function resolve(rows: Row[], ex: Executor = db): Promise<BundleView[]> {
  const ids = [...new Set(rows.flatMap(r => (r.items ?? []).map(i => i.variantId)))];
  if (!ids.length) return rows.map(r => view(r, []));
  const [variants, reserved] = await Promise.all([
    ex.select({ variantId: productVariants.id, productId: products.id, name: products.name, nameAr: products.nameAr, color: productVariants.name, colorAr: productVariants.nameAr, hex: productVariants.hex, stock: productVariants.stock, images: productVariants.images, primaryIndex: productVariants.primaryIndex, salePriceIqd: products.salePriceIqd, published: products.published })
      .from(productVariants).innerJoin(products, eq(productVariants.productId, products.id)).where(inArray(productVariants.id, ids)),
    reservedByVariant(ex as typeof db),
  ]);
  const byId = new Map(variants.map(v => [v.variantId, v]));
  return rows.map(r => view(r, (r.items ?? []).flatMap(i => {
    const v = byId.get(i.variantId); if (!v) return [];
    return [{ variantId: v.variantId, quantity: i.quantity, productId: v.productId, name: v.name, nameAr: v.nameAr, color: v.color, colorAr: v.colorAr, hex: v.hex, image: v.images?.[v.primaryIndex] ?? v.images?.[0] ?? null, priceIqd: v.salePriceIqd, available: Math.max(0, v.stock - (reserved.get(v.variantId) ?? 0)), published: v.published }];
  })));
}
function view(r: Row, parts: BundlePart[]): BundleView {
  const regularIqd = parts.reduce((s, p) => s + p.priceIqd * p.quantity, 0);
  const complete = parts.length === (r.items ?? []).length && parts.length > 0 && parts.every(p => p.published);
  const available = complete ? Math.min(...parts.map(p => Math.floor(p.available / Math.max(1, p.quantity)))) : 0;
  return { id: r.id, slug: r.slug, name: r.name, nameAr: r.nameAr, description: r.description, descriptionAr: r.descriptionAr, image: r.image ?? parts[0]?.image ?? null, priceIqd: r.priceIqd, regularIqd, savingIqd: Math.max(0, regularIqd - r.priceIqd), active: r.active, sortOrder: r.sortOrder, parts, available };
}

export async function listBundles(opts: { includeInactive?: boolean } = {}) {
  const rows = await db.select().from(bundles).orderBy(asc(bundles.sortOrder), asc(bundles.id));
  return resolve(opts.includeInactive ? rows : rows.filter(r => r.active));
}
// The list is cached with the catalog; availability is recomputed so it is never stale.
const cachedRows = unstable_cache(async () => db.select().from(bundles).where(eq(bundles.active, true)).orderBy(asc(bundles.sortOrder), asc(bundles.id)), ['bundles-v1'], { revalidate: 300, tags: [CATALOG_TAG] });
export async function getStoreBundles(): Promise<BundleView[]> {
  try { return (await resolve(await cachedRows())).filter(b => b.parts.length > 0 && b.parts.every(p => p.published)); }
  catch (error) { console.error('Loading bundles failed', error); return []; }
}
/** Pass the transaction when called inside one: the pool has a single connection. */
export async function getBundleById(id: number, ex: Executor = db) {
  const [row] = await ex.select().from(bundles).where(eq(bundles.id, id));
  return row ? (await resolve([row], ex))[0] : null;
}

/** Splits the bundle price across its lines by regular price; the remainder goes to the first line. */
export function splitBundlePrice(price: number, parts: { priceIqd: number; quantity: number }[]) {
  const regular = parts.reduce((s, p) => s + p.priceIqd * p.quantity, 0);
  const units = parts.map(p => regular > 0 ? Math.floor((price * p.priceIqd / regular)) : Math.floor(price / parts.reduce((s, x) => s + x.quantity, 0)));
  const used = units.reduce((s, u, i) => s + u * parts[i].quantity, 0);
  const rest = price - used;
  // Put the remainder on a single-unit line when possible so the order total matches exactly.
  const target = parts.findIndex(p => p.quantity === 1);
  if (rest !== 0) {
    if (target >= 0) units[target] += rest;
    else units[0] += Math.round(rest / parts[0].quantity);
  }
  return units;
}

export function cleanBundleItems(raw: unknown): BundleItem[] {
  if (!Array.isArray(raw)) return [];
  const merged = new Map<number, number>();
  for (const item of raw) {
    const v = Number((item as BundleItem)?.variantId), q = Number((item as BundleItem)?.quantity ?? 1);
    if (Number.isInteger(v) && v > 0 && Number.isInteger(q) && q > 0 && q <= 10) merged.set(v, (merged.get(v) ?? 0) + q);
  }
  return [...merged].slice(0, 8).map(([variantId, quantity]) => ({ variantId, quantity }));
}
