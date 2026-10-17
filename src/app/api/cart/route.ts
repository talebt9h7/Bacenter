import { NextRequest, NextResponse } from 'next/server';
import { and, eq, sql } from 'drizzle-orm';
import { db } from '@/db';
import {
  cartBundles,
  cartItems,
  productVariants,
  products,
} from '@/db/schema';
import { getBundleById, listBundles, normalizeSelection, withSelection } from '@/lib/bundles';
import { getSession } from '@/lib/session';
import { getSettings } from '@/lib/settings';
import { reservedByVariant, reservedForVariant } from '@/lib/reservations';
import { bestPromotion, getUpcomingPromotions } from '@/lib/promotions';
import {
  primaryImage,
  type CartLine,
} from '@/lib/types';

export const dynamic = 'force-dynamic';

export async function readCart(
  sessionId: string
): Promise<CartLine[]> {
  const settings = await getSettings();

  const rows = await db
    .select({
      id: cartItems.id,
      quantity: cartItems.quantity,
      variantId: productVariants.id,
      color: productVariants.name,
      colorAr: productVariants.nameAr,
      hex: productVariants.hex,
      stock: productVariants.stock,
      images: productVariants.images,
      primaryIndex: productVariants.primaryIndex,
      productId: products.id,
      name: products.name,
      nameAr: products.nameAr,
      priceCents: products.priceCents,
      salePriceIqd: products.salePriceIqd,
      category: products.category,
      capacity: products.capacity,
      published: products.published,
    })
    .from(cartItems)
    .innerJoin(
      productVariants,
      eq(
        cartItems.variantId,
        productVariants.id
      )
    )
    .innerJoin(
      products,
      eq(
        productVariants.productId,
        products.id
      )
    )
    .where(
      eq(
        cartItems.sessionId,
        sessionId
      )
    )
    .orderBy(cartItems.id);

  const [reserved, promos] = await Promise.all([reservedByVariant(), getUpcomingPromotions()]);
  const bundleLines = await readBundleLines(sessionId, settings.exchangeRate);
  return [...rows.map((row) => { const promo = bestPromotion({ id: row.productId, category: row.category, salePriceIqd: row.salePriceIqd }, promos); const unit = promo?.price ?? row.salePriceIqd; return ({
    id: row.id,
    variantId: row.variantId,
    productId: row.productId,
    name: row.name,
    nameAr: row.nameAr,
    color: row.color,
    colorAr: row.colorAr,
    price:
      unit /
      settings.exchangeRate,
    salePriceIqd: unit,
    originalPriceIqd: promo ? row.salePriceIqd : undefined,
    promotion: promo?.promotion ?? null,
    image: primaryImage({
      id: row.variantId,
      name: row.color,
      nameAr: row.nameAr,
      hex: row.hex,
      stock: row.stock,
      images: row.images ?? [],
      primaryIndex: row.primaryIndex,
    }),
    capacity: row.capacity,
    quantity: row.quantity,
    // What can still be bought: stock on hand minus units held by pending orders.
    stock: Math.max(0, row.stock - (reserved.get(row.variantId) ?? 0)),
  }); }), ...bundleLines];
}

async function readBundleLines(sessionId: string, rate: number): Promise<CartLine[]> {
  const rows = await db.select().from(cartBundles).where(eq(cartBundles.sessionId, sessionId)).orderBy(cartBundles.id);
  if (!rows.length) return [];
  const all = new Map((await listBundles({ includeInactive: true })).map(b => [b.id, b]));
  return rows.flatMap(row => {
    const base = all.get(row.bundleId); if (!base) return [];
    const b = withSelection(base, row.selection) ?? base;
    return [{ id: -row.id, variantId: 0, productId: `bundle-${b.slug}`, name: b.name, nameAr: b.nameAr || b.name, color: '', colorAr: '', price: b.priceIqd / rate, salePriceIqd: b.priceIqd, originalPriceIqd: b.regularIqd > b.priceIqd ? b.regularIqd : undefined, image: b.image ?? '', capacity: null, quantity: row.quantity, stock: b.active ? b.available : 0, bundle: { id: b.id, slug: b.slug, selection: row.selection ?? {}, parts: b.parts.map(p => ({ productId: p.productId, name: p.name, nameAr: p.nameAr, color: p.color, colorAr: p.colorAr, image: p.image, quantity: p.quantity })) } }];
  });
}

async function addBundle(sessionId: string, bundleId: number, quantity: number, rawSelection: unknown) {
  const base = await getBundleById(bundleId);
  if (!base || !base.active || !base.parts.length || !base.parts.every(p => p.published)) return NextResponse.json({ error: 'This bundle is no longer available.' }, { status: 404 });
  const chosen = normalizeSelection(base, rawSelection);
  if (!chosen) return NextResponse.json({ error: 'Please choose the colours again.' }, { status: 400 });
  const b = withSelection(base, chosen.selection)!;
  const [existing] = await db.select({ quantity: cartBundles.quantity }).from(cartBundles).where(and(eq(cartBundles.sessionId, sessionId), eq(cartBundles.bundleId, bundleId), eq(cartBundles.selectionKey, chosen.key)));
  const requested = (existing?.quantity ?? 0) + quantity;
  if (b.available <= 0) return NextResponse.json({ error: 'This colour combination is sold out right now.' }, { status: 409 });
  if (requested > b.available) return NextResponse.json({ error: `Only ${b.available} of this bundle left in these colours.` }, { status: 409 });
  await db.insert(cartBundles).values({ sessionId, bundleId, quantity, selection: chosen.selection, selectionKey: chosen.key }).onConflictDoUpdate({ target: [cartBundles.sessionId, cartBundles.bundleId, cartBundles.selectionKey], set: { quantity: sql`LEAST(${cartBundles.quantity} + ${quantity}, 10)` } });
  return NextResponse.json({ items: await readCart(sessionId) });
}

async function updateBundle(sessionId: string, rowId: number, quantity: number) {
  const condition = and(eq(cartBundles.sessionId, sessionId), eq(cartBundles.id, rowId));
  if (quantity === 0) await db.delete(cartBundles).where(condition);
  else {
    const [row] = await db.select({ bundleId: cartBundles.bundleId, selection: cartBundles.selection }).from(cartBundles).where(condition);
    const base = row ? await getBundleById(row.bundleId) : null;
    const b = base ? withSelection(base, row?.selection) : null;
    if (b && quantity > b.available) return NextResponse.json({ error: `Only ${b.available} of this bundle left.` }, { status: 409 });
    await db.update(cartBundles).set({ quantity }).where(condition);
  }
  return NextResponse.json({ items: await readCart(sessionId) });
}

export async function GET() {
  try {
    return NextResponse.json({
      items: await readCart(
        await getSession()
      ),
    });
  } catch (error) {
    console.error(
      'Cart read failed',
      error
    );

    return NextResponse.json(
      {
        error:
          'Your bag could not be loaded. Please try again.',
      },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest
) {
  try {
    const {
      variantId,
      bundleId,
      quantity = 1,
      selection,
    } = await request.json();

    if (bundleId !== undefined) {
      if (!Number.isInteger(bundleId) || !Number.isInteger(quantity) || quantity < 1 || quantity > 10) return NextResponse.json({ error: 'Please choose a valid bundle and quantity.' }, { status: 400 });
      return await addBundle(await getSession(), bundleId, quantity, selection);
    }

    if (
      !Number.isInteger(variantId) ||
      !Number.isInteger(quantity) ||
      quantity < 1 ||
      quantity > 10
    ) {
      return NextResponse.json(
        {
          error:
            'Please select a valid color and quantity.',
        },
        { status: 400 }
      );
    }

    const [variant] =
      await db
        .select({
          id: productVariants.id,
          stock: productVariants.stock,
          name: productVariants.name,
          published: products.published,
        })
        .from(productVariants)
        .innerJoin(
          products,
          eq(
            productVariants.productId,
            products.id
          )
        )
        .where(
          eq(
            productVariants.id,
            variantId
          )
        );

    if (
      !variant ||
      !variant.published
    ) {
      return NextResponse.json(
        {
          error:
            'That product is no longer available.',
        },
        { status: 404 }
      );
    }

    const sessionId =
      await getSession();

    const [existing] =
      await db
        .select({
          quantity:
            cartItems.quantity,
        })
        .from(cartItems)
        .where(
          and(
            eq(
              cartItems.sessionId,
              sessionId
            ),
            eq(
              cartItems.variantId,
              variantId
            )
          )
        );

    const requested =
      (existing?.quantity ?? 0) +
      quantity;

    // Units held by pending orders are not for sale.
    variant.stock = Math.max(0, variant.stock - await reservedForVariant(db, variant.id));

    if (variant.stock <= 0) {
      return NextResponse.json(
        {
          error: `${variant.name} is sold out right now. Try another color.`,
        },
        { status: 409 }
      );
    }

    if (
      requested >
      variant.stock
    ) {
      return NextResponse.json(
        {
          error: `Only ${variant.stock} left in ${variant.name}.`,
        },
        { status: 409 }
      );
    }

    await db
      .insert(cartItems)
      .values({
        sessionId,
        variantId,
        quantity,
      })
      .onConflictDoUpdate({
        target: [
          cartItems.sessionId,
          cartItems.variantId,
        ],
        set: {
          quantity: sql`LEAST(${cartItems.quantity} + ${quantity}, 10)`,
        },
      });

    return NextResponse.json({
      items: await readCart(
        sessionId
      ),
    });
  } catch (error) {
    console.error(
      'Cart add failed',
      error
    );

    return NextResponse.json(
      {
        error:
          'We couldn’t add that to your bag. Please try again.',
      },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest
) {
  try {
    const {
      id,
      quantity,
    } = await request.json();

    if (Number.isInteger(id) && id < 0 && Number.isInteger(quantity) && quantity >= 0 && quantity <= 10) return await updateBundle(await getSession(), -id, quantity);

    if (
      !Number.isInteger(id) ||
      !Number.isInteger(quantity) ||
      quantity < 0 ||
      quantity > 10
    ) {
      return NextResponse.json(
        {
          error:
            'Quantity must be between 0 and 10.',
        },
        { status: 400 }
      );
    }

    const sessionId =
      await getSession();

    const condition = and(
      eq(
        cartItems.sessionId,
        sessionId
      ),
      eq(
        cartItems.id,
        id
      )
    );

    if (quantity === 0) {
      await db
        .delete(cartItems)
        .where(condition);
    } else {
      const [line] =
        await db
          .select({
            variantId:
              productVariants.id,
            stock:
              productVariants.stock,
            name:
              productVariants.name,
          })
          .from(cartItems)
          .innerJoin(
            productVariants,
            eq(
              cartItems.variantId,
              productVariants.id
            )
          )
          .where(condition);

      if (line) line.stock = Math.max(0, line.stock - await reservedForVariant(db, line.variantId));
      if (
        line &&
        quantity > line.stock
      ) {
        return NextResponse.json(
          {
            error: `Only ${line.stock} left in ${line.name}.`,
          },
          { status: 409 }
        );
      }

      await db
        .update(cartItems)
        .set({ quantity })
        .where(condition);
    }

    return NextResponse.json({
      items: await readCart(
        sessionId
      ),
    });
  } catch (error) {
    console.error(
      'Cart update failed',
      error
    );

    return NextResponse.json(
      {
        error:
          'Your bag could not be updated.',
      },
      { status: 500 }
    );
  }
}