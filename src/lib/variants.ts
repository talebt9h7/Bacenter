import type { Product, ProductColor } from './types';

/**
 * Helpers for products with optional sizes. A product's `colors` list holds one entry per sellable
 * variant; with sizes that is one per colour × size, sharing the colour's name and photos.
 */
export function hasSizes(product: Pick<Product, 'colors'>) { return product.colors.some(c => !!c.size); }

/** One entry per colour (the first in-stock variant of it), with stock summed over its sizes. */
export function colorGroups(product: Pick<Product, 'colors'>): ProductColor[] {
  const map = new Map<string, { first: ProductColor; inStock?: ProductColor; stock: number }>();
  for (const c of product.colors) {
    const key = c.name.toLowerCase();
    const g = map.get(key);
    if (!g) map.set(key, { first: c, inStock: c.stock > 0 ? c : undefined, stock: c.stock });
    else { g.stock += c.stock; if (!g.inStock && c.stock > 0) g.inStock = c; }
  }
  return [...map.values()].map(g => ({ ...(g.inStock ?? g.first), stock: g.stock }));
}

export type SizeOption = { size: string; sizeAr: string; priceIqd: number | null };
/** The sizes in the order the shop set them. */
export function sizeOptions(product: Pick<Product, 'colors'>): SizeOption[] {
  const seen = new Map<string, SizeOption>();
  for (const c of product.colors) if (c.size && !seen.has(c.size)) seen.set(c.size, { size: c.size, sizeAr: c.sizeAr || c.size, priceIqd: c.priceIqd ?? null });
  return [...seen.values()];
}

/** The variant for a colour and size (or the colour's first variant when no size is given). */
export function findVariant(product: Pick<Product, 'colors'>, colorName: string, size?: string) {
  const same = product.colors.filter(c => c.name === colorName);
  return (size ? same.find(c => c.size === size) : undefined) ?? same.find(c => c.stock > 0) ?? same[0];
}

/** Price shown/charged for a variant: its own size price when set, otherwise the product price. */
export function variantPricing(product: Pick<Product, 'salePriceIqd' | 'originalPriceIqd'>, variant?: ProductColor) {
  if (variant?.priceIqd) return { price: variant.salePriceIqd ?? variant.priceIqd, regular: variant.originalPriceIqd ?? variant.priceIqd };
  return { price: product.salePriceIqd, regular: product.originalPriceIqd ?? product.salePriceIqd };
}

/** Lowest current price across sizes, and whether sizes differ in price (for "from …" labels). */
export function priceFrom(product: Pick<Product, 'colors' | 'salePriceIqd' | 'originalPriceIqd'>) {
  const prices = product.colors.map(c => variantPricing(product, c).price);
  const min = prices.length ? Math.min(...prices) : product.salePriceIqd;
  return { min, varies: prices.some(p => p !== min) };
}

/** "Brown · Large" style label for bags, orders and admin lists. */
export function variantLabel(color: string, size?: string | null) { return size ? `${color} · ${size}` : color; }
