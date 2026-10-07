import { NextRequest, NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { customers } from '@/db/schema';
import { requireAdminSection } from '@/lib/admin-auth';

export const dynamic = 'force-dynamic';

type Context = { params: Promise<{ id: string }> };
const clean = (value: unknown, max: number) => typeof value === 'string' ? value.trim().slice(0, max) : '';

export async function PATCH(request: NextRequest, { params }: Context) {
  if (!(await requireAdminSection('sales', 'view'))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const { id } = await params;
  try {
    const body = await request.json();
    const tags = Array.isArray(body.tags) ? body.tags.map((tag: unknown) => clean(tag, 40)).filter(Boolean).slice(0, 20) : [];
    const preferredChannel = ['whatsapp', 'phone', 'email'].includes(body.preferredChannel) ? body.preferredChannel : 'whatsapp';
    const [row] = await db.update(customers).set({
      name: clean(body.name, 100) || undefined,
      email: clean(body.email, 254).toLowerCase() || null,
      note: clean(body.note, 1000) || null,
      tags,
      marketingOptIn: body.marketingOptIn === true,
      preferredChannel,
      updatedAt: new Date(),
    }).where(eq(customers.id, Number(id))).returning();
    if (!row) return NextResponse.json({ error: 'Customer not found.' }, { status: 404 });
    return NextResponse.json({ item: row });
  } catch (error) {
    console.error('Customer update failed', error);
    return NextResponse.json({ error: 'The customer could not be updated.' }, { status: 500 });
  }
}

export async function POST(request: NextRequest, { params }: Context) {
  if (!(await requireAdminSection('sales', 'manage'))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  if (body.action !== 'contacted') return NextResponse.json({ error: 'Unknown action.' }, { status: 400 });
  const [row] = await db.update(customers).set({ lastContactAt: new Date(), updatedAt: new Date() }).where(eq(customers.id, Number(id))).returning();
  return row ? NextResponse.json({ item: row }) : NextResponse.json({ error: 'Customer not found.' }, { status: 404 });
}
