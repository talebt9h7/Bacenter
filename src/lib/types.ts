import type { ProductDetails } from './product-details';

/** `stock` is what can still be sold (on hand − reserved by pending orders). `onHand` is physical stock. */
export type ProductColor = { id: number; name: string; nameAr: string; hex: string; stock: number; onHand?: number; reserved?: number; images: string[]; primaryIndex: number };
export type Product = {
  id: string; name: string; nameAr: string; subtitle: string; subtitleAr: string; description: string; descriptionAr: string; price: number; salePriceIqd: number; category: string;
  capacity?: string | null; badge?: string | null; features: string[]; specifications?: string[]; warranty?: string; materials?: string; storyImages?: string[]; dimensions: string; dimensionsImage?: string; tags: string[];
  published: boolean; colors: ProductColor[];
  /** Set while a promotion applies: salePriceIqd is then the promotional price and this is the regular one. */
  originalPriceIqd?: number; promotion?: AppliedPromotion | null;
  /** Product-page content (headline, highlights, features, specs, warranty, materials, photos). */
  details: ProductDetails;
};
export type CartLine = { id: number; variantId: number; productId: string; name: string; nameAr: string; color: string; colorAr: string; price: number; salePriceIqd: number; image: string; capacity: string | null; quantity: number; stock: number; originalPriceIqd?: number; promotion?: AppliedPromotion | null };

export const PLACEHOLDER_IMAGE = '/images/placeholder.svg';
export function primaryImage(color?: ProductColor) { if (!color) return PLACEHOLDER_IMAGE; return color.images[color.primaryIndex] ?? color.images[0] ?? PLACEHOLDER_IMAGE; }
export function hoverImage(color?: ProductColor) { if (!color) return PLACEHOLDER_IMAGE; const alternate = color.images.find((_, index) => index !== color.primaryIndex); return alternate ?? primaryImage(color); }
export function productImage(product: Product) { return primaryImage(product.colors.find(color => color.stock > 0) ?? product.colors[0]); }
export function totalStock(product: Product) { return product.colors.reduce((sum, color) => sum + color.stock, 0); }

/** Widths the media endpoint can resize to. Keep in sync with what the CDN should store. */
export const MEDIA_WIDTHS = [160, 320, 480, 640, 960, 1280, 1600] as const;
/**
 * Returns a resized URL for images uploaded through the admin media library
 * (stored in the database). Other images (static files, external URLs) are returned unchanged.
 */
export function mediaSrc(url: string | null | undefined, width: number) {
  if (!url) return PLACEHOLDER_IMAGE;
  if (!url.startsWith('/api/media/') || url.includes('?')) return url;
  return `${url}?w=${width}`;
}
/** srcSet for a database image so the browser picks the size that fits the screen. */
export function mediaSrcSet(url: string | null | undefined, widths: readonly number[]) {
  if (!url || !url.startsWith('/api/media/') || url.includes('?')) return undefined;
  return widths.map(width => `${url}?w=${width} ${width}w`).join(', ');
}

/** A live promotion as shown on the storefront. endsAt is an ISO string. */
export type AppliedPromotion = { id: number; name: string; nameAr: string; badge: string; badgeAr: string; endsAt: string; showCountdown: boolean; percentOff: number };
