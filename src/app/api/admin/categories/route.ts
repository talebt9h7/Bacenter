import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { asc, eq, sql } from 'drizzle-orm';
import { db } from '@/db';
import { categories, products } from '@/db/schema';
import { requireAdminSection } from '@/lib/admin-auth';
import { logActivity } from '@/lib/activity-log';
import { invalidateCatalog } from '@/lib/cache-tags';

export const dynamic = 'force-dynamic';

const clean = (v: unknown, max = 200) =>
  String(v ?? '').trim().slice(0, max);

const slug = (v: unknown) =>
  clean(v, 80)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

const href = (v: unknown) => { const h = clean(v, 300); return h.startsWith('/') || /^https?:\/\//.test(h) ? h : ''; };
/** Heading and banner fields of a category page (drizzle/0035). */
const pageFields = (body: Record<string, unknown> | null) => ({
  eyebrow: clean(body?.eyebrow, 120), eyebrowAr: clean(body?.eyebrowAr, 120),
  headline: clean(body?.headline, 160), headlineAr: clean(body?.headlineAr, 160),
  bannerActive: body?.bannerActive === true,
  bannerImage: clean(body?.bannerImage, 500), bannerMobileImage: clean(body?.bannerMobileImage, 500),
  bannerTitle: clean(body?.bannerTitle, 160), bannerTitleAr: clean(body?.bannerTitleAr, 160),
  bannerSubtitle: clean(body?.bannerSubtitle, 300), bannerSubtitleAr: clean(body?.bannerSubtitleAr, 300),
  bannerCta: clean(body?.bannerCta, 60), bannerCtaAr: clean(body?.bannerCtaAr, 60),
  bannerHref: href(body?.bannerHref),
});

export async function GET() {
  const actor = await requireAdminSection('catalog', 'view');

  if (!actor) {
    return NextResponse.json(
      { error: 'Forbidden' },
      { status: 403 }
    );
  }

  const rows = await db
    .select()
    .from(categories)
    .orderBy(
      asc(categories.sortOrder),
      asc(categories.name)
    );

  const usage = await db
    .select({
      category: products.category,
      count: sql<number>`count(*)`,
    })
    .from(products)
    .groupBy(products.category);

  const counts = Object.fromEntries(
    usage.map((x) => [x.category, Number(x.count)])
  );

  return NextResponse.json({
    categories: rows.map((x) => ({
      ...x,
      productCount: counts[x.id] ?? 0,
    })),
  });
}

export async function POST(request: NextRequest) {
  const actor = await requireAdminSection(
    'catalog',
    'manage'
  );

  if (!actor) {
    return NextResponse.json(
      { error: 'Forbidden' },
      { status: 403 }
    );
  }

  const body = await request.json().catch(() => null);

  const id = slug(body?.id || body?.name);
  const name = clean(body?.name, 100);
  const nameAr =
    clean(body?.nameAr, 100) || name;

  if (!id || !name || id === 'all') {
    return NextResponse.json(
      {
        error:
          'Valid category name and slug are required.',
      },
      { status: 400 }
    );
  }

  try {
    const [row] = await db
      .insert(categories)
      .values({
        id,
        name,
        nameAr,
        description: clean(
          body?.description,
          500
        ),
        descriptionAr:
          clean(body?.descriptionAr, 500) ||
          clean(body?.description, 500),
        image:
          clean(body?.image, 500) || null,
        active: body?.active !== false,
        sortOrder:
          Number(body?.sortOrder) || 0,
        ...pageFields(body),
      })
      .returning();

    await logActivity(
      actor,
      'category.create',
      'category',
      id,
      `Created category: ${name}`
    );

    invalidateCatalog();
  revalidatePath('/');
    revalidatePath(`/products/category/${id}`);

    return NextResponse.json(
      { category: row },
      { status: 201 }
    );
  } catch {
    return NextResponse.json(
      { error: 'Category slug already exists.' },
      { status: 409 }
    );
  }
}

export async function PUT(request: NextRequest) {
  const actor = await requireAdminSection(
    'catalog',
    'manage'
  );

  if (!actor) {
    return NextResponse.json(
      { error: 'Forbidden' },
      { status: 403 }
    );
  }

  const body = await request.json().catch(() => null);

  const id = clean(body?.id, 80);

  if (!id) {
    return NextResponse.json(
      { error: 'Category id is required.' },
      { status: 400 }
    );
  }

  const name = clean(body?.name, 100);
  const nameAr =
    clean(body?.nameAr, 100) || name;

  if (!name) {
    return NextResponse.json(
      { error: 'Category name is required.' },
      { status: 400 }
    );
  }

  const [row] = await db
    .update(categories)
    .set({
      name,
      nameAr,
      description: clean(
        body?.description,
        500
      ),
      descriptionAr:
        clean(body?.descriptionAr, 500) ||
        clean(body?.description, 500),
      image:
        clean(body?.image, 500) || null,
      active: body?.active !== false,
      // "Shop all" always stays first.
      sortOrder: id === 'all' ? -1000 : Number(body?.sortOrder) || 0,
      ...pageFields(body),
      updatedAt: new Date(),
    })
    .where(eq(categories.id, id))
    .returning();

  if (!row) {
    return NextResponse.json(
      { error: 'Category not found.' },
      { status: 404 }
    );
  }

  await logActivity(
    actor,
    'category.update',
    'category',
    id,
    `Updated category: ${name}`
  );

  invalidateCatalog();
  revalidatePath('/');
  revalidatePath(`/products/category/${id}`);

  return NextResponse.json({
    category: row,
  });
}

export async function DELETE(request: NextRequest) {
  const actor = await requireAdminSection(
    'catalog',
    'manage'
  );

  if (!actor) {
    return NextResponse.json(
      { error: 'Forbidden' },
      { status: 403 }
    );
  }

  const body = await request.json().catch(() => null);

  const id = clean(body?.id, 80);

  if (!id) {
    return NextResponse.json(
      { error: 'Category id is required.' },
      { status: 400 }
    );
  }

  if (id === 'all') {
    return NextResponse.json({ error: 'The “Shop all” page cannot be deleted. Switch it off instead.' }, { status: 400 });
  }

  const [used] = await db
    .select({
      count: sql<number>`count(*)`,
    })
    .from(products)
    .where(eq(products.category, id));

  if (Number(used?.count ?? 0) > 0) {
    return NextResponse.json(
      {
        error:
          'Cannot delete a category that still has products. Reassign its products first.',
      },
      { status: 409 }
    );
  }

  const [row] = await db
    .delete(categories)
    .where(eq(categories.id, id))
    .returning();

  if (!row) {
    return NextResponse.json(
      { error: 'Category not found.' },
      { status: 404 }
    );
  }

  await logActivity(
    actor,
    'category.delete',
    'category',
    id,
    `Deleted category: ${row.name}`
  );

  invalidateCatalog();
  revalidatePath('/');
  revalidatePath(`/products/category/${id}`);

  return NextResponse.json({
    ok: true,
  });
}
/** Saves the storefront order: { order: [id, id, …] } → sortOrder 0, 10, 20 … */
export async function PATCH(request: NextRequest) {
  const actor = await requireAdminSection('catalog', 'manage');
  if (!actor) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const body = await request.json().catch(() => null);
  const order = Array.isArray(body?.order) ? (body.order.map((x: unknown) => clean(x, 80)).filter(Boolean) as string[]).filter(id => id !== 'all').slice(0, 500) : [];
  if (!order.length) return NextResponse.json({ error: 'Order is required.' }, { status: 400 });
  await db.transaction(async tx => {
    for (const [i, id] of order.entries()) await tx.update(categories).set({ sortOrder: i * 10, updatedAt: new Date() }).where(eq(categories.id, id));
  });
  await logActivity(actor, 'category.update', 'category', 'order', 'Reordered categories');
  invalidateCatalog();
  revalidatePath('/');
  revalidatePath('/products/category/all');
  return NextResponse.json({ ok: true });
}
