import { asc, eq } from 'drizzle-orm';
import { db } from '@/db';
import { banners, contentPages, coupons, expenses, shippingZones } from '@/db/schema';

type Row = Record<string, unknown>;
const str = (value: unknown, max = 300) => typeof value === 'string' ? value.trim().slice(0, max) : '';
const int = (value: unknown, fallback = 0) => Number.isFinite(Number(value)) ? Math.round(Number(value)) : fallback;
const bool = (value: unknown, fallback = true) => typeof value === 'boolean' ? value : fallback;
const date = (value: unknown) => { if (!value || typeof value !== 'string') return null; const parsed = new Date(value); return Number.isNaN(parsed.getTime()) ? null : parsed; };
const isLink = (value: string) => value.startsWith('/') || /^https?:\/\//.test(value);
const isImage = (value: string) => /^\/(images|api\/media)\//.test(value) || /^https?:\/\//.test(value);

export type Resource = { list: () => Promise<Row[]>; create?: (body: Row) => Promise<{ error?: string; row?: Row }>; update: (id: string, body: Row) => Promise<{ error?: string; row?: Row }>; remove?: (id: string) => Promise<void>; label: string };

export const resources: Record<string, Resource> = {
  banners: {
    label: 'banner',
    list: () => db.select().from(banners).orderBy(asc(banners.kind), asc(banners.sortOrder), asc(banners.id)),
    async create(body) { const parsed = parseBanner(body); if ('error' in parsed) return parsed; const [row] = await db.insert(banners).values(parsed.data).returning(); return { row }; },
    async update(id, body) { const parsed = parseBanner(body); if ('error' in parsed) return parsed; const [row] = await db.update(banners).set({ ...parsed.data, updatedAt: new Date() }).where(eq(banners.id, Number(id))).returning(); return row ? { row } : { error: 'Banner not found.' }; },
    async remove(id) { await db.delete(banners).where(eq(banners.id, Number(id))); },
  },
  coupons: {
    label: 'coupon',
    list: () => db.select().from(coupons).orderBy(asc(coupons.active), asc(coupons.code)),
    async create(body) { const parsed = parseCoupon(body); if ('error' in parsed) return parsed; try { const [row] = await db.insert(coupons).values(parsed.data).returning(); return { row }; } catch { return { error: 'A coupon with that code already exists.' }; } },
    async update(id, body) { const parsed = parseCoupon(body); if ('error' in parsed) return parsed; const [row] = await db.update(coupons).set(parsed.data).where(eq(coupons.id, Number(id))).returning(); return row ? { row } : { error: 'Coupon not found.' }; },
    async remove(id) { await db.delete(coupons).where(eq(coupons.id, Number(id))); },
  },
  expenses: {
    label: 'expense',
    list: () => db.select().from(expenses).orderBy(asc(expenses.expenseDate)),
    async create(body) { const parsed = parseExpense(body); if ('error' in parsed) return parsed; const [row] = await db.insert(expenses).values(parsed.data).returning(); return { row }; },
    async update(id, body) { const parsed = parseExpense(body); if ('error' in parsed) return parsed; const [row] = await db.update(expenses).set({ ...parsed.data, updatedAt: new Date() }).where(eq(expenses.id, Number(id))).returning(); return row ? { row } : { error: 'Expense not found.' }; },
    async remove(id) { await db.delete(expenses).where(eq(expenses.id, Number(id))); },
  },
  'shipping-zones': {
    label: 'shipping zone',
    list: () => db.select().from(shippingZones).orderBy(asc(shippingZones.sortOrder)),
    async update(id, body) {
      const rate = int(body.rate, -1); const minDays = int(body.minDays, 1); const maxDays = int(body.maxDays, minDays);
      if (rate < 0 || rate > 1000000) return { error: 'Enter a delivery rate in IQD (0 or more).' };
      if (minDays < 0 || maxDays < minDays || maxDays > 60) return { error: 'Delivery days must be a sensible range.' };
      const [row] = await db.update(shippingZones).set({ rate, minDays, maxDays, enabled: bool(body.enabled) }).where(eq(shippingZones.id, Number(id))).returning();
      return row ? { row } : { error: 'Zone not found.' };
    },
  },
  content: {
    label: 'content page',
    list: () => db.select().from(contentPages).orderBy(asc(contentPages.slug)),
    async update(slug, body) {
      const title = str(body.title, 160); if (!title) return { error: 'Every page needs an English title.' };
      const titleAr = str(body.titleAr, 160); if (!titleAr) return { error: 'Every page needs an Arabic title.' };
      const parseSections = (value: unknown) => Array.isArray(value) ? value.map((section: Row) => ({ title: str(section.title, 160), text: str(section.text, 4000) })).filter((section: { title: string; text: string }) => section.title || section.text).slice(0, 20) : [];
      const parseFaqs = (value: unknown) => Array.isArray(value) ? value.map((faq: Row) => ({ question: str(faq.question, 200), answer: str(faq.answer, 3000) })).filter((faq: { question: string; answer: string }) => faq.question).slice(0, 30) : [];
      const sections = parseSections(body.sections);
      const sectionsAr = parseSections(body.sectionsAr);
      const faqs = parseFaqs(body.faqs);
      const faqsAr = parseFaqs(body.faqsAr);
      const image = str(body.image, 500);
      const [row] = await db.update(contentPages).set({ eyebrow: str(body.eyebrow, 80), eyebrowAr: str(body.eyebrowAr, 80), title, titleAr, subtitle: str(body.subtitle, 400), subtitleAr: str(body.subtitleAr, 400), image: image && isImage(image) ? image : null, sections, sectionsAr, faqs, faqsAr, published: bool(body.published), updatedAt: new Date() }).where(eq(contentPages.slug, slug)).returning();
      return row ? { row } : { error: 'Page not found.' };
    },
  },
};
function parseBanner(body: Row) {
  const kind = ['hero', 'highlight', 'promo', 'category'].includes(String(body.kind)) ? String(body.kind) : 'hero';
  const categoryId = str(body.categoryId, 80) || null;
  const title = str(body.title, 160); const titleAr = str(body.titleAr, 160) || null; const image = str(body.image, 500); const href = str(body.href, 500) || '/'; const mobileImage = str(body.mobileImage, 500);
  if (!title) return { error: 'Give the banner a title.' };
  if (body.titleAr !== undefined && !titleAr) return { error: 'Give the banner an Arabic title.' };
  if (!image || !isImage(image)) return { error: 'Upload an image or paste an image URL.' };
  if (!isLink(href)) return { error: 'The link must start with / or https://.' };
  if (kind === 'category' && !categoryId) return { error: 'Choose a category for this banner.' };
  return { data: { kind, categoryId, title, titleAr, subtitle: str(body.subtitle, 300) || null, subtitleAr: str(body.subtitleAr, 300) || null, ctaLabel: str(body.ctaLabel, 60) || null, ctaLabelAr: str(body.ctaLabelAr, 60) || null, href, image, mobileImage: mobileImage && isImage(mobileImage) ? mobileImage : null, badge: str(body.badge, 20).toUpperCase() || null, badgeAr: str(body.badgeAr, 20) || null, active: bool(body.active), startsAt: date(body.startsAt), endsAt: date(body.endsAt), sortOrder: int(body.sortOrder) } };
}

function parseExpense(body: Row) {
  const categories = ['marketing','advertising','packaging','salary','rent','software','delivery','photography','operations','other'];
  const paymentMethods = ['cash','bank','card','transfer','other'];
  const category = categories.includes(String(body.category)) ? String(body.category) : 'other';
  const paymentMethod = paymentMethods.includes(String(body.paymentMethod)) ? String(body.paymentMethod) : 'cash';
  const description = str(body.description, 240); const amountIqd = int(body.amountIqd, -1); const expenseDate = date(body.expenseDate) || new Date();
  if (!description) return { error: 'Every expense needs a description.' };
  if (amountIqd <= 0 || amountIqd > 1000000000) return { error: 'Enter a valid expense amount in IQD.' };
  return { data: { category, description, amountIqd, expenseDate, paymentMethod, reference: str(body.reference, 120) || null, notes: str(body.notes, 1000) || null } };
}

function parseCoupon(body: Row) {
  const code = str(body.code, 40).toUpperCase().replace(/[^A-Z0-9-]/g, ''); const type = body.type === 'fixed' ? 'fixed' : 'percent'; const value = int(body.value, -1);
  if (code.length < 3) return { error: 'Coupon codes need at least 3 letters or numbers.' };
  if (value <= 0 || (type === 'percent' && value > 100)) return { error: type === 'percent' ? 'Percentage must be between 1 and 100.' : 'Enter a discount amount in IQD.' };
  const maxUsesRaw = body.maxUses; const maxUses = maxUsesRaw === null || maxUsesRaw === '' || maxUsesRaw === undefined ? null : int(maxUsesRaw, 0);
  return { data: { code, type, value, minSubtotal: Math.max(0, int(body.minSubtotal)), maxUses: maxUses !== null && maxUses > 0 ? maxUses : null, freeShipping: bool(body.freeShipping, false), active: bool(body.active), expiresAt: date(body.expiresAt) } };
}
