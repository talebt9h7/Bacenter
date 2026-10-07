import { NextRequest, NextResponse } from 'next/server';
import { and, eq, sql } from 'drizzle-orm';
import { db } from '@/db';
import { cartItems, productVariants, products } from '@/db/schema';
import { getSession } from '@/lib/session';
import { ensureSeeded } from '@/lib/products';
import { getSettings } from '@/lib/settings';
import { primaryImage, type CartLine } from '@/lib/types';

export const dynamic = 'force-dynamic';
export async function readCart(sessionId: string): Promise<CartLine[]> {
  const settings = await getSettings();
  const rows = await db.select({ id: cartItems.id, quantity: cartItems.quantity, variantId: productVariants.id, color: productVariants.name, hex: productVariants.hex, stock: productVariants.stock, images: productVariants.images, primaryIndex: productVariants.primaryIndex, productId: products.id, name: products.name, priceCents: products.priceCents, salePriceIqd: products.salePriceIqd, capacity: products.capacity, published: products.published })
    .from(cartItems).innerJoin(productVariants, eq(cartItems.variantId, productVariants.id)).innerJoin(products, eq(productVariants.productId, products.id)).where(eq(cartItems.sessionId, sessionId)).orderBy(cartItems.id);
  return rows.map(row => ({ id: row.id, variantId: row.variantId, productId: row.productId, name: row.name, color: row.color, price: row.salePriceIqd / settings.exchangeRate, salePriceIqd: row.salePriceIqd, image: primaryImage({ id: row.variantId, name: row.color, hex: row.hex, stock: row.stock, images: row.images ?? [], primaryIndex: row.primaryIndex }), capacity: row.capacity, quantity: row.quantity, stock: row.stock }));
}
export async function GET() {
  try { await ensureSeeded(); return NextResponse.json({ items: await readCart(await getSession()) }); }
  catch (error) { console.error('Cart read failed', error); return NextResponse.json({ error: 'Your bag could not be loaded. Please try again.' }, { status: 500 }); }
}
export async function POST(request: NextRequest) {
  try {
    const { variantId, quantity = 1 } = await request.json();
    if (!Number.isInteger(variantId) || !Number.isInteger(quantity) || quantity < 1 || quantity > 10) return NextResponse.json({ error: 'Please select a valid color and quantity.' }, { status: 400 });
    const [variant] = await db.select({ id: productVariants.id, stock: productVariants.stock, name: productVariants.name, published: products.published }).from(productVariants).innerJoin(products, eq(productVariants.productId, products.id)).where(eq(productVariants.id, variantId));
    if (!variant || !variant.published) return NextResponse.json({ error: 'That product is no longer available.' }, { status: 404 });
    const sessionId = await getSession();
    const [existing] = await db.select({ quantity: cartItems.quantity }).from(cartItems).where(and(eq(cartItems.sessionId, sessionId), eq(cartItems.variantId, variantId)));
    const requested = (existing?.quantity ?? 0) + quantity;
    if (variant.stock <= 0) return NextResponse.json({ error: `${variant.name} is sold out right now. Try another color.` }, { status: 409 });
    if (requested > variant.stock) return NextResponse.json({ error: `Only ${variant.stock} left in ${variant.name}.` }, { status: 409 });
    await db.insert(cartItems).values({ sessionId, variantId, quantity }).onConflictDoUpdate({ target: [cartItems.sessionId, cartItems.variantId], set: { quantity: sql`LEAST(${cartItems.quantity} + ${quantity}, 10)` } });
    return NextResponse.json({ items: await readCart(sessionId) });
  } catch (error) { console.error('Cart add failed', error); return NextResponse.json({ error: 'We couldn’t add that to your bag. Please try again.' }, { status: 500 }); }
}
export async function PATCH(request: NextRequest) {
  try {
    const { id, quantity } = await request.json();
    if (!Number.isInteger(id) || !Number.isInteger(quantity) || quantity < 0 || quantity > 10) return NextResponse.json({ error: 'Quantity must be between 0 and 10.' }, { status: 400 });
    const sessionId = await getSession();
    const condition = and(eq(cartItems.sessionId, sessionId), eq(cartItems.id, id));
    if (quantity === 0) await db.delete(cartItems).where(condition);
    else {
      const [line] = await db.select({ stock: productVariants.stock, name: productVariants.name }).from(cartItems).innerJoin(productVariants, eq(cartItems.variantId, productVariants.id)).where(condition);
      if (line && quantity > line.stock) return NextResponse.json({ error: `Only ${line.stock} left in ${line.name}.` }, { status: 409 });
      await db.update(cartItems).set({ quantity }).where(condition);
    }
    return NextResponse.json({ items: await readCart(sessionId) });
  } catch (error) { console.error('Cart update failed', error); return NextResponse.json({ error: 'Your bag could not be updated.' }, { status: 500 }); }
}
