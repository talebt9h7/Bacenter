/** Validates a promotion sent by the admin editor. Returns the row to save or an error message. */
export function parsePromotion(body: Record<string, unknown>) {
  const text = (key: string, max = 120) => typeof body[key] === 'string' ? (body[key] as string).trim().slice(0, max) : '';
  const name = text('name'), nameAr = text('nameAr');
  const type = text('type', 10), scope = text('scope', 12);
  const value = Math.round(Number(body.value));
  const startsAt = new Date(String(body.startsAt ?? '')), endsAt = new Date(String(body.endsAt ?? ''));
  const list = (key: string) => Array.isArray(body[key]) ? [...new Set((body[key] as unknown[]).map(v => String(v).trim()).filter(Boolean))].slice(0, 500) : [];
  if (name.length < 2 && nameAr.length < 2) return { error: 'Give the offer a name.' };
  if (!['percent', 'amount', 'price'].includes(type)) return { error: 'Choose how the price is reduced.' };
  if (!Number.isFinite(value) || value <= 0) return { error: 'Enter a discount value above zero.' };
  if (type === 'percent' && value > 95) return { error: 'A percentage discount can be at most 95%.' };
  if (!['all', 'categories', 'products'].includes(scope)) return { error: 'Choose which products the offer covers.' };
  const categoryIds = scope === 'categories' ? list('categoryIds') : [];
  const productIds = scope === 'products' ? list('productIds') : [];
  if (scope === 'categories' && !categoryIds.length) return { error: 'Pick at least one category.' };
  if (scope === 'products' && !productIds.length) return { error: 'Pick at least one product.' };
  if (Number.isNaN(startsAt.getTime()) || Number.isNaN(endsAt.getTime())) return { error: 'Set when the offer starts and ends.' };
  if (endsAt <= startsAt) return { error: 'The offer must end after it starts.' };
  if (endsAt.getTime() - startsAt.getTime() > 366 * 86_400_000) return { error: 'An offer can run for at most one year.' };
  return { data: { name: name || nameAr, nameAr: nameAr || name, type, value, scope, categoryIds, productIds, startsAt, endsAt, active: body.active !== false, showCountdown: body.showCountdown !== false, badge: text('badge', 30), badgeAr: text('badgeAr', 30) } };
}
