import { NextRequest, NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { requireAdminSection } from '@/lib/admin-auth';
import { db } from '@/db';
import { payments } from '@/db/schema';
import { syncPayment } from '@/lib/payments';

export const dynamic = 'force-dynamic';
/** Re-checks one payment with the provider (for a shopper who paid but never came back). */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await requireAdminSection('sales', 'view'))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const { id } = await params;
  const [row] = await db.select().from(payments).where(eq(payments.id, Number(id)));
  if (!row) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  try {
    const updated = await syncPayment(row, request.nextUrl.origin);
    return NextResponse.json({ status: updated.status });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message.slice(0, 300) : 'Check failed' }, { status: 502 });
  }
}
