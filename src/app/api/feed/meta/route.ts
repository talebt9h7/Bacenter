import { NextRequest } from 'next/server';
import { getAllProducts } from '@/lib/products';
import { getCategories } from '@/lib/categories';

export const dynamic = 'force-dynamic';

/**
 * Product feed for the Meta catalog (CSV, fetched by Meta on a schedule).
 * One item per product, with id = product id, so it matches the content_ids the Pixel and the
 * Conversions API send. Price is the current price (promotions included, with the regular price
 * as `price` and the promotional one as `sale_price`); availability follows the stock of all colours.
 */
const COLUMNS = ['id', 'title', 'description', 'availability', 'condition', 'price', 'sale_price', 'link', 'image_link', 'additional_image_link', 'brand', 'product_type', 'color', 'quantity_to_sell_on_facebook', 'inventory'] as const;

function cell(value: string | number) {
  const text = String(value ?? '').replace(/\r?\n+/g, ' ').trim();
  return /[",]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export async function GET(request: NextRequest) {
  const origin = request.nextUrl.origin.replace('http://', 'https://');
  const absolute = (src: string) => {
    if (!src) return '';
    const url = src.startsWith('http') ? src : `${origin}${src.startsWith('/') ? '' : '/'}${src}`;
    return url.includes('/api/media/') ? `${url}${url.includes('?') ? '&' : '?'}w=1280&f=jpg` : url;
  };
  const [products, categories] = await Promise.all([getAllProducts(), getCategories()]);
  const categoryName = new Map(categories.map(c => [c.id, c.nameAr || c.name]));
  const rows: string[] = [COLUMNS.join(',')];
  for (const p of products) {
    const colors = p.colors.filter(c => c.images.some(Boolean));
    if (!colors.length) continue;
    const images = colors.flatMap(c => { const list = c.images.filter(Boolean); const first = list[c.primaryIndex] ?? list[0]; return [first, ...list.filter(i => i !== first)]; });
    const main = images[0];
    const extra = [...new Set(images.slice(1))].filter(i => i !== main && !i.endsWith('.svg')).slice(0, 10).map(absolute).join(',');
    if (!main || main.endsWith('.svg')) continue;
    const stock = p.colors.reduce((s, c) => s + Math.max(0, c.stock), 0);
    const regular = p.originalPriceIqd && p.originalPriceIqd > p.salePriceIqd ? p.originalPriceIqd : p.salePriceIqd;
    const onSale = regular > p.salePriceIqd;
    const title = (p.nameAr || p.name).slice(0, 150);
    const description = (p.descriptionAr || p.subtitleAr || p.description || p.subtitle || title).replace(/<[^>]+>/g, ' ').slice(0, 5000);
    const record: Record<(typeof COLUMNS)[number], string | number> = {
      id: p.id,
      title,
      description,
      availability: stock > 0 ? 'in stock' : 'out of stock',
      condition: 'new',
      price: `${Math.round(regular)} IQD`,
      sale_price: onSale ? `${Math.round(p.salePriceIqd)} IQD` : '',
      link: `${origin}/products/${encodeURIComponent(p.id)}`,
      image_link: absolute(main),
      additional_image_link: extra,
      brand: 'UR Leather',
      product_type: categoryName.get(p.category) ?? p.category,
      color: [...new Set(p.colors.map(c => c.nameAr || c.name))].slice(0, 3).join(' / '),
      quantity_to_sell_on_facebook: stock,
      inventory: stock,
    };
    rows.push(COLUMNS.map(k => cell(record[k])).join(','));
  }
  return new Response(`﻿${rows.join('\n')}\n`, {
    headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Cache-Control': 'public, s-maxage=900, stale-while-revalidate=3600' },
  });
}
