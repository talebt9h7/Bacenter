import { NextRequest, NextResponse } from 'next/server';
import { saveAccountsSettings } from '@/lib/accounts';
import { logActivity } from '@/lib/orders';
import { canManage, failure, forbidden } from '../_shared';

export async function PUT(request: NextRequest) {
  if (!(await canManage())) return forbidden();
  const body = await request.json().catch(() => ({}));
  try {
    const value = await saveAccountsSettings({ ...(body.qasehFeePercent !== undefined ? { qasehFeePercent: Number(body.qasehFeePercent) } : {}), ...(body.defaultCourierId !== undefined ? { defaultCourierId: body.defaultCourierId ? Number(body.defaultCourierId) : null } : {}) });
    await logActivity('update', 'accounts_settings', undefined, `عمولة القاصة ${value.qasehFeePercent}% · الشركة الافتراضية ${value.defaultCourierId ?? '—'}`);
    return NextResponse.json({ settings: value });
  } catch (error) { return failure(error, 'ما انحفظت الإعدادات.'); }
}
