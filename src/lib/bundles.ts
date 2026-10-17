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
/** Another colour of the same product the customer may pick for a bundle item. */
export type BundleOption = { variantId: number; color: string; colorAr: string; hex: string; image: string | null; images: string[]; available: number };
export type BundlePart = { variantId: number; quantity: number; productId: string; name: string; nameAr: string; color: string; colorAr: string; hex: string; image: string | null; images: string[]; priceIqd: number; available: number; published: boolean; options: BundleOption[] };
export type BundleView = { id: number; slug: string; name: string; nameAr: string; description: string; descriptionAr: string; image: string | null; priceIqd: number; regularIqd: number; savingIqd: number; active: boolean; sortOrder: number; parts: BundlePart[]; available: number };

type Row = typeof bundles.$inferSelect;
type Executor = Pick<typeof db, 'select'>;
async function resolve(rows: Row[], ex: Executor = db): Promise<BundleView[]> {
  const ids = [...new Set(rows.flatMap(r => (r.items ?? []).map(i => i.variantId)))];
  if (!ids.length) return rows.map(r => view(r, []));
  const base = await ex.select({ productId: productVariants.productId }).from(productVariants).where(inArray(productVariants.id, ids));
  const productIds = [...new Set(base.map(b => b.productId))];
  const [variants, reserved] = await Promise.all([
    ex.select({ variantId: productVariants.id, productId: products.id, name: products.name, nameAr: products.nameAr, color: productVariants.name, colorAr: productVariants.nameAr, hex: productVariants.hex, stock: productVariants.stock, images: productVariants.images, primaryIndex: productVariants.primaryIndex, salePriceIqd: products.salePriceIqd, published: products.published, sortOrder: productVariants.sortOrder })
      .from(productVariants).innerJoin(products, eq(productVariants.productId, products.id)).where(inArray(products.id, productIds)).orderBy(asc(productVariants.sortOrder), asc(productVariants.id)),
    reservedByVariant(ex as typeof db),
  ]);
  const byId = new Map(variants.map(v => [v.variantId, v]));
  const avail = (v: typeof variants[number]) => Math.max(0, v.stock - (reserved.get(v.variantId) ?? 0));
  const imagesOf = (v: typeof variants[number]) => { const list = v.images ?? []; const first = list[v.primaryIndex] ?? list[0]; return first ? [first, ...list.filter(i => i !== first)] : []; };
  const optionsFor = (productId: string): BundleOption[] => variants.filter(v => v.productId === productId).map(v => ({ variantId: v.variantId, color: v.color, colorAr: v.colorAr || v.color, hex: v.hex, image: imagesOf(v)[0] ?? null, images: imagesOf(v), available: avail(v) }));
  return rows.map(r => view(r, (r.items ?? []).flatMap(i => {
    const v = byId.get(i.variantId); if (!v) return [];
    const imgs = imagesOf(v);
    return [{ variantId: v.variantId, quantity: i.quantity, productId: v.productId, name: v.name, nameAr: v.nameAr || v.name, color: v.color, colorAr: v.colorAr || v.color, hex: v.hex, image: imgs[0] ?? null, images: imgs, priceIqd: v.salePriceIqd, available: avail(v), published: v.published, options: optionsFor(v.productId) }];
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

/**
 * The bundle with the customer's colour choices applied ({ "<item index>": variantId }).
 * A choice must be another colour of the same product; anything else returns null.
 */
export function withSelection(bundle: BundleView, selection: Record<string, number> | null | undefined): BundleView | null {
  const sel = selection ?? {};
  const parts: BundlePart[] = [];
  for (const [index, part] of bundle.parts.entries()) {
    const wanted = sel[String(index)];
    if (wanted === undefined || wanted === part.variantId) { parts.push(part); continue; }
    const option = part.options.find(o => o.variantId === Number(wanted));
    if (!option) return null;
    parts.push({ ...part, variantId: option.variantId, color: option.color, colorAr: option.colorAr, hex: option.hex, image: option.image, images: option.images, available: option.available });
  }
  const available = parts.length && parts.every(p => p.published) ? Math.min(...parts.map(p => Math.floor(p.available / Math.max(1, p.quantity)))) : 0;
  return { ...bundle, parts, available };
}
/** Only the items whose colour differs from the bundle default, as a stable key for the bag line. */
export function normalizeSelection(bundle: BundleView, raw: unknown): { selection: Record<string, number>; key: string } | null {
  const sel: Record<string, number> = {};
  if (raw && typeof raw === 'object') {
    for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
      const index = Number(k), id = Number(v);
      if (!Number.isInteger(index) || index < 0 || index >= bundle.parts.length || !Number.isInteger(id)) return null;
      if (id !== bundle.parts[index].variantId) sel[String(index)] = id;
    }
  }
  if (!withSelection(bundle, sel)) return null;
  const key = Object.keys(sel).sort((a, b) => Number(a) - Number(b)).map(k => `${k}:${sel[k]}`).join('|');
  return { selection: sel, key };
}
