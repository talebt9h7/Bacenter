import { NextRequest, NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { supportMessages } from '@/db/schema';
import { requireAdminSection } from '@/lib/admin-auth';

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await requireAdminSection('storefront', 'view'))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const { id } = await params; const body = await request.json().catch(() => ({}));
  const status = body.status === 'resolved' ? 'resolved' : 'open';
  const [row] = await db.update(supportMessages).set({ status }).where(eq(supportMessages.id, Number(id))).returning();
  return row ? NextResponse.json({ item: row }) : NextResponse.json({ error: 'Message not found.' }, { status: 404 });
}
