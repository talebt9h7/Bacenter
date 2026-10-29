import { eq, inArray, notInArray, and } from 'drizzle-orm';
import { db } from '@/db';
import { products, productVariants } from '@/db/schema';
import { adjustStock, receiveInventoryBatch } from './orders';
import { invalidateCatalog } from './cache-tags';
import { cleanDetails, type ProductDetails } from './product-details';
import { categories as legacyCategories } from './catalog';
import { categories as categoryTable } from '@/db/schema';
import { NotReadyError, publishChecklist } from './publish-checklist';

// baseStock is the stock the editor loaded. Saving applies only the difference, so orders
// placed while the editor was open are not overwritten.
export type VariantInput = { id?: number; name: string; nameAr?: string; hex: string; stock: number; baseStock?: number; images: string[]; primaryIndex: number; size?: string; sizeAr?: string; priceIqd?: number | null };
export type ProductInput = { id: string; name: string; nameAr?: string; subtitle: string; subtitleAr?: string; description: string; descriptionAr?: string; price: number; salePriceIqd: number; wholesalePriceIqd?: number; purchasePriceUsd: number | null; exchangeRate: number; category: string; capacity: string | null; badge: string | null; features: string[]; specifications: string[]; warranty: string; materials: string; storyImages: string[]; dimensions: string; dimensionsImage: string; tags: string[]; published: boolean; colors: VariantInput[]; details?: ProductDetails & { v: 1 } };

const isImage = (value: unknown): value is string => typeof value === 'string' && value.length < 2000 && (/^\/(images|api\/media)\//.test(value) || /^https?:\/\//.test(value));
const cleanList = (value: unknown, max: number) => Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0).map(item => item.trim().slice(0, 200)).slice(0, max) : [];

export function validateProductInput(body: unknown): { data?: ProductInput; error?: string } {
  if (!body || typeof body !== 'object') return { error: 'Invalid product payload.' };
  const raw = body as Record<string, unknown>;
  const id = typeof raw.id === 'string' ? raw.id.trim().toLowerCase() : '';
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id) || id.length > 80) return { error: 'The URL handle must use lowercase letters, numbers and hyphens only.' };
  const name = typeof raw.name === 'string' ? raw.name.trim() : '';
  const nameAr = typeof raw.nameAr === 'string' ? raw.nameAr.trim() : name;
  if (!name || name.length > 120) return { error: 'Please give the product a name (max 120 characters).' };
  const salePriceIqd = Number(raw.salePriceIqd ?? raw.priceIqd ?? 0);
  if (!Number.isFinite(salePriceIqd) || salePriceIqd < 0 || salePriceIqd > 1000000000) return { error: 'Please enter a valid sale price in IQD.' };
  const purchasePriceRaw = raw.purchasePriceUsd;
  const purchasePriceUsd = purchasePriceRaw === null || purchasePriceRaw === undefined || purchasePriceRaw === '' ? null : Number(purchasePriceRaw);
  if (purchasePriceUsd !== null && (!Number.isFinite(purchasePriceUsd) || purchasePriceUsd < 0 || purchasePriceUsd > 100000)) return { error: 'Please enter a valid purchase cost in USD.' };
  const exchangeRateRaw = raw.exchangeRate;
  const exchangeRate = Number(exchangeRateRaw);
  if (!Number.isFinite(exchangeRate) || exchangeRate <= 0) return { error: 'Please enter a valid exchange rate.' };
  const category = typeof raw.category === 'string' ? raw.category : '';
  if (!category || category === 'all') return { error: 'Please choose a valid category.' };
  const colorsRaw = Array.isArray(raw.colors) ? raw.colors : [];
  if (!colorsRaw.length) return { error: 'Add at least one color with its own stock and images.' };
  if (colorsRaw.length > 120) return { error: 'A product can have up to 120 colour and size combinations.' };
  const descriptionAr = typeof raw.descriptionAr === 'string' ? raw.descriptionAr.trim().slice(0, 4000) : (typeof raw.description === 'string' ? raw.description.trim().slice(0, 4000) : '');
  const subtitleAr = typeof raw.subtitleAr === 'string' ? raw.subtitleAr.trim().slice(0, 200) : (typeof raw.subtitle === 'string' ? raw.subtitle.trim().slice(0, 200) : '');
  const colors: VariantInput[] = [];
  const seen = new Set<string>();
  for (const item of colorsRaw) {
    if (!item || typeof item !== 'object') return { error: 'Invalid color entry.' };
    const color = item as Record<string, unknown>;
    const colorName = typeof color.name === 'string' ? color.name.trim() : '';
    const colorNameAr = typeof color.nameAr === 'string' ? color.nameAr.trim() : colorName;
    if (!colorName || colorName.length > 60) return { error: 'Every color needs a name (max 60 characters).' };
    const size = typeof color.size === 'string' ? color.size.trim().slice(0, 40) : '';
    const sizeAr = typeof color.sizeAr === 'string' ? color.sizeAr.trim().slice(0, 40) : size;
    const priceRaw = color.priceIqd;
    const priceIqd = priceRaw === null || priceRaw === undefined || priceRaw === '' ? null : Math.round(Number(priceRaw));
    if (priceIqd !== null && (!Number.isFinite(priceIqd) || priceIqd <= 0 || priceIqd > 1000000000)) return { error: `The price for size “${size}” must be above zero.` };
    const seenKey = `${colorName.toLowerCase()}|${size.toLowerCase()}`;
    if (seen.has(seenKey)) return { error: size ? `“${colorName}” in size “${size}” is listed twice.` : `The color “${colorName}” is listed twice.` };
    seen.add(seenKey);
    const hex = typeof color.hex === 'string' && /^#[0-9a-f]{6}$/i.test(color.hex) ? color.hex.toLowerCase() : '#333333';
    const stock = Number(color.stock);
    if (!Number.isInteger(stock) || stock < 0 || stock > 1000000) return { error: `Stock for “${colorName}” must be a whole number of 0 or more.` };
    const images = Array.isArray(color.images) ? color.images.filter(isImage).slice(0, 12) : [];
    const primaryIndex = Number.isInteger(color.primaryIndex) ? Math.min(Math.max(Number(color.primaryIndex), 0), Math.max(images.length - 1, 0)) : 0;
    const baseStock = Number.isInteger(color.baseStock) && Number(color.baseStock) >= 0 ? Number(color.baseStock) : undefined;
    colors.push({ id: Number.isInteger(color.id) ? Number(color.id) : undefined, name: colorName, nameAr: colorNameAr, hex, stock, baseStock, images, primaryIndex, size, sizeAr: sizeAr || size, priceIqd: size ? priceIqd : null });
  }
  // Either every variant has a size or none does.
  if (colors.some(c => c.size) && colors.some(c => !c.size)) return { error: 'Every colour needs a stock for each size.' };
  return { data: { id, name, nameAr, subtitle: typeof raw.subtitle === 'string' ? raw.subtitle.trim().slice(0, 200) : '', description: typeof raw.description === 'string' ? raw.description.trim().slice(0, 4000) : '', descriptionAr, price: Math.round((salePriceIqd / exchangeRate) * 100) / 100, salePriceIqd: Math.round(salePriceIqd), wholesalePriceIqd: Number.isFinite(Number(raw.wholesalePriceIqd)) && raw.wholesalePriceIqd !== undefined ? Math.max(0, Math.round(Number(raw.wholesalePriceIqd))) : undefined, purchasePriceUsd: purchasePriceUsd === null ? null : Math.round(purchasePriceUsd * 100) / 100, exchangeRate, category, capacity: typeof raw.capacity === 'string' && raw.capacity.trim() ? raw.capacity.trim().slice(0, 40) : null, badge: typeof raw.badge === 'string' && raw.badge.trim() ? raw.badge.trim().slice(0, 40).toUpperCase() : null, features: cleanList(raw.features, 12), specifications: cleanList(raw.specifications, 30), warranty: typeof raw.warranty === 'string' ? raw.warranty.trim().slice(0, 2000) : '', materials: typeof raw.materials === 'string' ? raw.materials.trim().slice(0, 2000) : '', storyImages: Array.isArray(raw.storyImages) ? raw.storyImages.filter(isImage).slice(0, 20) : [], dimensions: typeof raw.dimensions === 'string' ? raw.dimensions.trim().slice(0, 120) : '', dimensionsImage: isImage(raw.dimensionsImage) ? raw.dimensionsImage : '', tags: cleanList(raw.tags, 20).map(tag => tag.toLowerCase().replace(/\s+/g, '-')), published: raw.published === true, colors,
    // Product-page content from the new editor. Absent from older clients, in which case it is left as it is.
    details: raw.details && typeof raw.details === 'object' ? { ...cleanDetails(raw.details), v: 1 as const } : undefined } };
}

export async function saveProduct(data: ProductInput, { create = false } = {}) {
  const [categoryRow] = await db.select({ id: categoryTable.id }).from(categoryTable).where(eq(categoryTable.id, data.category)).limit(1);
  if (!categoryRow && !legacyCategories.some(item => item.id === data.category && item.id !== 'all')) throw new Error('INVALID_CATEGORY');
  const result = await db.transaction(async tx => {
    // Going live for the first time (new product, or a draft being published) needs the full checklist.
    if (data.published) {
      const [before] = create ? [] : await tx.select({ published: products.published }).from(products).where(eq(products.id, data.id));
      if (create || before?.published === false) {
        const missing = publishChecklist({ name: data.name, nameAr: data.nameAr, salePriceIqd: data.salePriceIqd, description: data.description, descriptionAr: data.descriptionAr, featuresAr: data.details?.featuresAr, features: data.details?.features, colors: data.colors }).filter(i => !i.ok);
        if (missing.length) throw new NotReadyError(missing);
      }
    }
    const values = { ...(data.wholesalePriceIqd !== undefined ? { wholesalePriceIqd: data.wholesalePriceIqd } : {}), name: data.name, nameAr: data.nameAr || data.name, subtitle: data.subtitle, subtitleAr: data.subtitleAr || data.subtitle, description: data.description, descriptionAr: data.descriptionAr || data.description, priceCents: Math.round(data.price * 100), salePriceIqd: data.salePriceIqd, category: data.category, capacity: data.capacity, badge: data.badge, features: data.features, specifications: data.specifications, warranty: data.warranty, materials: data.materials, storyImages: data.storyImages, dimensions: data.dimensions, dimensionsImage: data.dimensionsImage, tags: data.tags, published: data.published, updatedAt: new Date(), ...(data.details ? { details: data.details } : {}) };
    if (create) {
      const [existing] = await tx.select({ id: products.id }).from(products).where(eq(products.id, data.id));
      if (existing) throw new Error('DUPLICATE');
      const all = await tx.select({ sortOrder: products.sortOrder }).from(products);
      await tx.insert(products).values({ id: data.id, ...values, sortOrder: all.length });
    } else {
      const updated = await tx.update(products).set(values).where(eq(products.id, data.id)).returning({ id: products.id });
      if (!updated.length) throw new Error('NOT_FOUND');
    }
    const existingVariants = await tx.select({ id: productVariants.id, stock: productVariants.stock }).from(productVariants).where(eq(productVariants.productId, data.id));
    const existingStock = new Map(existingVariants.map(variant => [variant.id, variant.stock]));
    const keepIds: number[] = [];
    for (const [index, color] of data.colors.entries()) {
      // Stock is never written directly: it goes through the inventory ledger so purchase
      // batches stay consistent with stock and every change is logged as a movement.
      const record = { productId: data.id, name: color.name, nameAr: color.nameAr || color.name, hex: color.hex, images: color.images, primaryIndex: color.primaryIndex, sortOrder: index, size: color.size || '', sizeAr: color.sizeAr || color.size || '', priceIqd: color.size ? color.priceIqd ?? null : null };
      if (color.id && existingStock.has(color.id)) {
        await tx.update(productVariants).set(record).where(and(eq(productVariants.id, color.id), eq(productVariants.productId, data.id)));
        keepIds.push(color.id);
        const delta = color.stock - (color.baseStock ?? existingStock.get(color.id)!);
        if (delta !== 0) await adjustStock(tx, color.id, delta, 'Product editor');
        continue;
      }
      const [inserted] = await tx.insert(productVariants).values({ ...record, stock: 0 }).returning({ id: productVariants.id });
      keepIds.push(inserted.id);
      if (color.stock <= 0) continue;
      if (data.purchasePriceUsd !== null) {
        await receiveInventoryBatch(tx, {
          variantId: inserted.id,
          quantity: color.stock,
          purchaseCostUsdCents: Math.round(data.purchasePriceUsd * 100),
          purchaseExchangeRate: Math.round(data.exchangeRate),
          batchNumber: `INITIAL-${data.id}-${index + 1}`,
          notes: create ? 'Initial stock received when product was created' : 'Stock added with a new color in the product editor',
        });
      } else if (create) {
        throw new Error('PURCHASE_PRICE_REQUIRED');
      } else {
        await adjustStock(tx, inserted.id, color.stock, 'Product editor (new color, cost unknown)');
      }
    }
    if (keepIds.length) await tx.delete(productVariants).where(and(eq(productVariants.productId, data.id), notInArray(productVariants.id, keepIds)));
    return keepIds;
  });
  invalidateCatalog();
  return result;
}
export async function deleteProducts(ids: string[]) { if (ids.length) await db.delete(products).where(inArray(products.id, ids)); invalidateCatalog(); }
