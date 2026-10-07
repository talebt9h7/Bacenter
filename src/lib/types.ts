export type ProductColor = { id: number; name: string; nameAr: string; hex: string; stock: number; images: string[]; primaryIndex: number };
export type Product = {
  id: string; name: string; nameAr: string; subtitle: string; subtitleAr: string; description: string; descriptionAr: string; price: number; salePriceIqd: number; category: string;
  capacity?: string | null; badge?: string | null; features: string[]; dimensions: string; tags: string[];
  published: boolean; colors: ProductColor[];
};
export type CartLine = { id: number; variantId: number; productId: string; name: string; color: string; price: number; salePriceIqd: number; image: string; capacity: string | null; quantity: number; stock: number };

export const PLACEHOLDER_IMAGE = '/images/placeholder.svg';
export function primaryImage(color?: ProductColor) { if (!color) return PLACEHOLDER_IMAGE; return color.images[color.primaryIndex] ?? color.images[0] ?? PLACEHOLDER_IMAGE; }
export function hoverImage(color?: ProductColor) { if (!color) return PLACEHOLDER_IMAGE; const alternate = color.images.find((_, index) => index !== color.primaryIndex); return alternate ?? primaryImage(color); }
export function productImage(product: Product) { return primaryImage(product.colors.find(color => color.stock > 0) ?? product.colors[0]); }
export function totalStock(product: Product) { return product.colors.reduce((sum, color) => sum + color.stock, 0); }
