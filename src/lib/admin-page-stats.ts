import { sql } from 'drizzle-orm';
import { db } from '@/db';
import { getSettings } from './settings';

/**
 * KPI tiles for admin pages that have no dashboard of their own (coupons, purchases, messages,
 * catalog structure, storefront content, configuration). One query per page; values are plain
 * numbers so the client tile can format and animate them.
 */
export type KpiIcon = 'tag' | 'ticket' | 'percent' | 'wallet' | 'truck' | 'users' | 'mail' | 'inbox' | 'boxes' | 'layers' | 'folder' | 'image' | 'video' | 'store' | 'link' | 'map' | 'shield' | 'clock' | 'activity' | 'database' | 'file' | 'eye' | 'eyeoff' | 'alert' | 'check' | 'menu' | 'bell' | 'search' | 'coins' | 'calendar';
export type KpiTone = 'accent' | 'success' | 'blue' | 'gold' | 'violet' | 'danger';
export type KpiSpec = { icon: KpiIcon; tone: KpiTone; en: string; ar: string; value: number; format?: 'number' | 'iqd' | 'percent' | 'bytes'; noteEn?: string; noteAr?: string; href?: string };
export type PageKey = 'coupons' | 'purchases' | 'messages' | 'categories' | 'collections' | 'sections' | 'banners' | 'videos' | 'media' | 'stores' | 'redirects' | 'shipping' | 'team' | 'activity' | 'backup' | 'content' | 'seo' | 'navigation' | 'footer' | 'homepage' | 'settings';

async function one<T extends Record<string, unknown>>(query: ReturnType<typeof sql>) {
  const result = await db.execute(query);
  const rows = (Array.isArray(result) ? result : (result as { rows: unknown[] }).rows) as T[];
  return rows[0] ?? ({} as T);
}
const n = (v: unknown) => Number(v ?? 0) || 0;
const day = (v: unknown) => v ? new Date(String(v)).toISOString().slice(0, 10) : '';

export async function pageStats(page: PageKey): Promise<KpiSpec[]> {
  try { return await load(page); } catch (error) { console.error('pageStats', page, error); return []; }
}

async function load(page: PageKey): Promise<KpiSpec[]> {
  switch (page) {
    case 'coupons': {
      const r = await one(sql`select
        (select count(*) from coupons where active and (expires_at is null or expires_at > now()) and (max_uses is null or used_count < max_uses)) live,
        (select count(*) from coupons) total,
        (select coalesce(sum(used_count),0) from coupons) used,
        (select count(*) from coupons where (expires_at is not null and expires_at <= now()) or (max_uses is not null and used_count >= max_uses)) ended,
        (select coalesce(sum(discount_cents),0) from orders where coupon_code is not null and status not in ('cancelled','returned')) discount,
        (select coalesce(sum(total_cents),0) from orders where coupon_code is not null and status not in ('cancelled','returned')) sales`);
      return [
        { icon: 'ticket', tone: 'accent', en: 'Live coupons', ar: 'كوبونات فعالة', value: n(r.live), noteEn: `${n(r.total)} in total`, noteAr: `${n(r.total)} بالمجموع` },
        { icon: 'check', tone: 'success', en: 'Times used', ar: 'مرات الاستخدام', value: n(r.used) },
        { icon: 'percent', tone: 'gold', en: 'Discount given', ar: 'قيمة الخصم الممنوح', value: n(r.discount), format: 'iqd', noteEn: 'excl. cancelled & returned', noteAr: 'بدون الملغية والمرتجعة' },
        { icon: 'coins', tone: 'blue', en: 'Sales with a coupon', ar: 'مبيعات بكوبون', value: n(r.sales), format: 'iqd' },
        { icon: 'clock', tone: 'danger', en: 'Expired or used up', ar: 'منتهية أو مستنفدة', value: n(r.ended) },
      ];
    }
    case 'purchases': {
      const r = await one(sql`select
        (select count(*) from suppliers where active) suppliers,
        (select count(*) from purchases where status <> 'cancelled') purchases,
        (select coalesce(sum(total_cost_iqd),0) from purchases where status = 'received') spend,
        (select coalesce(sum(quantity),0) from purchase_items) units,
        (select coalesce(sum(total_cost_iqd),0) from purchases where status = 'received' and purchase_date >= date_trunc('month', now() at time zone 'Asia/Baghdad')) this_month,
        (select max(purchase_date) from purchases) last`);
      return [
        { icon: 'truck', tone: 'accent', en: 'Purchases', ar: 'عمليات الشراء', value: n(r.purchases), noteEn: r.last ? `last ${day(r.last)}` : 'none yet', noteAr: r.last ? `آخرها ${day(r.last)}` : 'لا يوجد بعد' },
        { icon: 'wallet', tone: 'gold', en: 'Total spend', ar: 'إجمالي الإنفاق', value: n(r.spend), format: 'iqd' },
        { icon: 'calendar', tone: 'blue', en: 'Spent this month', ar: 'إنفاق هذا الشهر', value: n(r.this_month), format: 'iqd' },
        { icon: 'boxes', tone: 'success', en: 'Units received', ar: 'قطع مستلمة', value: n(r.units) },
        { icon: 'users', tone: 'violet', en: 'Active suppliers', ar: 'موردون فعالون', value: n(r.suppliers) },
      ];
    }
    case 'messages': {
      const r = await one(sql`select
        (select count(*) from support_messages where status = 'open') open,
        (select count(*) from support_messages) total,
        (select count(*) from support_messages where created_at >= now() - interval '7 days') week,
        (select count(*) from newsletter_subscribers) subs,
        (select count(*) from newsletter_subscribers where created_at >= now() - interval '30 days') subs30`);
      return [
        { icon: 'inbox', tone: n(r.open) ? 'danger' : 'success', en: 'Open messages', ar: 'رسائل مفتوحة', value: n(r.open), noteEn: `${n(r.total)} in total`, noteAr: `${n(r.total)} بالمجموع` },
        { icon: 'clock', tone: 'blue', en: 'Last 7 days', ar: 'آخر 7 أيام', value: n(r.week) },
        { icon: 'mail', tone: 'accent', en: 'Subscribers', ar: 'المشتركون', value: n(r.subs) },
        { icon: 'users', tone: 'gold', en: 'New subscribers (30 days)', ar: 'مشتركون جدد (30 يوم)', value: n(r.subs30) },
      ];
    }
    case 'categories': {
      const r = await one(sql`select
        (select count(*) from categories) total,
        (select count(*) from categories where active) active,
        (select count(*) from categories c where not exists (select 1 from products p where p.category = c.id)) empty,
        (select count(*) from products p where not exists (select 1 from categories c where c.id = p.category)) orphan,
        (select count(*) from categories where image is null or image = '') noimage`);
      return [
        { icon: 'folder', tone: 'accent', en: 'Categories', ar: 'التصنيفات', value: n(r.total) },
        { icon: 'eye', tone: 'success', en: 'Shown in the store', ar: 'ظاهرة بالمتجر', value: n(r.active) },
        { icon: 'boxes', tone: 'gold', en: 'Without products', ar: 'بدون منتجات', value: n(r.empty) },
        { icon: 'alert', tone: 'danger', en: 'Products with no valid category', ar: 'منتجات بتصنيف غير موجود', value: n(r.orphan), href: '/admin/products' },
        { icon: 'image', tone: 'violet', en: 'Without an image', ar: 'بدون صورة', value: n(r.noimage) },
      ];
    }
    case 'collections': {
      const cols = (await getSettings()).homepage.collections;
      const active = cols.filter(c => c.active).length;
      const manual = cols.filter(c => (c.productIds ?? []).length > 0).length;
      const linked = new Set(cols.flatMap(c => c.productIds ?? [])).size;
      return [
        { icon: 'layers', tone: 'accent', en: 'Collections', ar: 'المجموعات', value: cols.length },
        { icon: 'eye', tone: 'success', en: 'Active', ar: 'نشطة', value: active },
        { icon: 'boxes', tone: 'blue', en: 'Hand-picked', ar: 'منتجاتها مختارة يدوياً', value: manual },
        { icon: 'tag', tone: 'gold', en: 'Products in collections', ar: 'منتجات داخل مجموعات', value: linked },
      ];
    }
    case 'sections': case 'banners': {
      const r = await one(sql`select
        (select count(*) from banners where kind = 'hero') hero,
        (select count(*) from banners where kind = 'hero' and active and (starts_at is null or starts_at <= now()) and (ends_at is null or ends_at > now())) heroLive,
        (select count(*) from banners where kind not in ('hero','category')) other,
        (select count(*) from banners where active and starts_at > now()) scheduled,
        (select count(*) from banners where ends_at is not null and ends_at <= now()) ended,
        (select count(*) from categories where active) cats,
        (select count(distinct category_id) from banners where kind = 'category' and active) catBanners`);
      if (page === 'sections') return [
        { icon: 'folder', tone: 'accent', en: 'Store sections', ar: 'أقسام المتجر', value: n(r.cats) },
        { icon: 'image', tone: 'success', en: 'With a banner', ar: 'لها بانر', value: n(r.catbanners) },
        { icon: 'alert', tone: 'gold', en: 'Without a banner', ar: 'بدون بانر', value: Math.max(0, n(r.cats) - n(r.catbanners)) },
      ];
      return [
        { icon: 'image', tone: 'accent', en: 'Hero slides live', ar: 'شرائح ظاهرة الآن', value: n(r.herolive), noteEn: `${n(r.hero)} in total`, noteAr: `${n(r.hero)} بالمجموع` },
        { icon: 'layers', tone: 'blue', en: 'Cards & promo banners', ar: 'بطاقات وبانرات ترويجية', value: n(r.other) },
        { icon: 'calendar', tone: 'violet', en: 'Scheduled', ar: 'مجدولة', value: n(r.scheduled) },
        { icon: 'clock', tone: 'danger', en: 'Ended', ar: 'منتهية', value: n(r.ended) },
      ];
    }
    case 'videos': {
      const r = await one(sql`select count(*) total, count(*) filter (where active) active from video_stories`);
      const p = await one(sql`select count(*) filter (where coalesce(details->>'videoId','') <> '') withvideo, count(*) total from products`);
      return [
        { icon: 'video', tone: 'accent', en: 'Homepage videos', ar: 'فيديوهات الرئيسية', value: n(r.total) },
        { icon: 'eye', tone: 'success', en: 'Shown', ar: 'ظاهرة', value: n(r.active) },
        { icon: 'boxes', tone: 'blue', en: 'Products with a video', ar: 'منتجات بيها فيديو', value: n(p.withvideo), noteEn: `of ${n(p.total)}`, noteAr: `من ${n(p.total)}`, href: '/admin/products' },
      ];
    }
    case 'media': {
      const r = await one(sql`select count(*) total, coalesce(sum(size),0) bytes, count(*) filter (where created_at >= now() - interval '30 days') recent, coalesce(max(size),0) biggest from media`);
      return [
        { icon: 'image', tone: 'accent', en: 'Files', ar: 'الملفات', value: n(r.total) },
        { icon: 'database', tone: 'blue', en: 'Storage used', ar: 'المساحة المستخدمة', value: n(r.bytes), format: 'bytes' },
        { icon: 'calendar', tone: 'success', en: 'Added in 30 days', ar: 'مضافة آخر 30 يوم', value: n(r.recent) },
        { icon: 'alert', tone: 'gold', en: 'Largest file', ar: 'أكبر ملف', value: n(r.biggest), format: 'bytes' },
      ];
    }
    case 'stores': {
      const r = await one(sql`select count(*) total, count(*) filter (where active) active, count(*) filter (where map_url = '') nomap from store_locations`);
      return [
        { icon: 'store', tone: 'accent', en: 'Points of sale', ar: 'نقاط البيع', value: n(r.total) },
        { icon: 'eye', tone: 'success', en: 'Shown', ar: 'ظاهرة', value: n(r.active) },
        { icon: 'eyeoff', tone: 'gold', en: 'Hidden', ar: 'مخفية', value: n(r.total) - n(r.active) },
        { icon: 'map', tone: 'danger', en: 'Without a map link', ar: 'بدون رابط خريطة', value: n(r.nomap) },
      ];
    }
    case 'redirects': {
      const r = await one(sql`select count(*) total, count(*) filter (where active) active, count(*) filter (where status_code = 301) permanent, count(*) filter (where status_code <> 301) temporary from url_redirects`);
      return [
        { icon: 'link', tone: 'accent', en: 'Redirects', ar: 'التحويلات', value: n(r.total) },
        { icon: 'check', tone: 'success', en: 'Active', ar: 'فعالة', value: n(r.active) },
        { icon: 'shield', tone: 'blue', en: 'Permanent (301)', ar: 'دائمة (301)', value: n(r.permanent) },
        { icon: 'clock', tone: 'gold', en: 'Temporary', ar: 'مؤقتة', value: n(r.temporary) },
      ];
    }
    case 'shipping': {
      const s = await getSettings();
      const r = await one(sql`select count(*) total, count(*) filter (where enabled) enabled, coalesce(min(rate) filter (where enabled),0) lo, coalesce(max(rate) filter (where enabled),0) hi, coalesce(round(avg(max_days) filter (where enabled)),0) days from shipping_zones`);
      const o = await one(sql`select count(*) filter (where shipping_cents = 0) free, count(*) total, coalesce(sum(shipping_cents),0) fees from orders where status not in ('cancelled','returned') and created_at >= now() - interval '30 days'`);
      return [
        { icon: 'map', tone: 'accent', en: 'Governorates open', ar: 'محافظات مفعلة', value: n(r.enabled), noteEn: `of ${n(r.total)}`, noteAr: `من ${n(r.total)}` },
        { icon: 'truck', tone: 'blue', en: 'Delivery rate', ar: 'أجور التوصيل', value: n(r.hi), format: 'iqd', noteEn: n(r.lo) !== n(r.hi) ? `from ${n(r.lo).toLocaleString('en-US')}` : 'same everywhere', noteAr: n(r.lo) !== n(r.hi) ? `من ${n(r.lo).toLocaleString('en-US')}` : 'نفس السعر لكل المحافظات' },
        { icon: 'tag', tone: 'success', en: 'Free delivery from', ar: 'التوصيل المجاني من', value: s.freeShippingThreshold, format: 'iqd' },
        { icon: 'percent', tone: 'gold', en: 'Free-delivery orders (30 days)', ar: 'طلبات بتوصيل مجاني (30 يوم)', value: n(o.total) ? Math.round(n(o.free) / n(o.total) * 100) : 0, format: 'percent', noteEn: `${n(o.free)} of ${n(o.total)}`, noteAr: `${n(o.free)} من ${n(o.total)}` },
        { icon: 'coins', tone: 'violet', en: 'Delivery fees collected (30 days)', ar: 'أجور توصيل مستلمة (30 يوم)', value: n(o.fees), format: 'iqd' },
        { icon: 'clock', tone: 'danger', en: 'Typical max days', ar: 'أقصى مدة توصيل (معدل)', value: n(r.days) },
      ];
    }
    case 'team': {
      const r = await one(sql`select count(*) total, count(*) filter (where active) active, count(distinct role) roles, max(last_login_at) last, count(*) filter (where last_login_at >= now() - interval '7 days') recent from admin_users`);
      return [
        { icon: 'users', tone: 'accent', en: 'Team members', ar: 'أعضاء الفريق', value: n(r.total) },
        { icon: 'check', tone: 'success', en: 'Active', ar: 'فعالون', value: n(r.active) },
        { icon: 'shield', tone: 'blue', en: 'Roles in use', ar: 'أدوار مستخدمة', value: n(r.roles) },
        { icon: 'clock', tone: 'gold', en: 'Signed in this week', ar: 'دخلوا هذا الأسبوع', value: n(r.recent), noteEn: r.last ? `last ${day(r.last)}` : undefined, noteAr: r.last ? `آخر دخول ${day(r.last)}` : undefined },
      ];
    }
    case 'activity': {
      const r = await one(sql`select count(*) filter (where created_at >= date_trunc('day', now() at time zone 'Asia/Baghdad') at time zone 'Asia/Baghdad') today,
        count(*) filter (where created_at >= now() - interval '7 days') week, count(*) total,
        (select count(*) from order_events where created_at >= now() - interval '7 days') orders,
        count(*) filter (where entity in ('inventory','inventory_batch','product','variant') and created_at >= now() - interval '7 days') stock from activity_log`);
      return [
        { icon: 'activity', tone: 'accent', en: 'Today', ar: 'اليوم', value: n(r.today) },
        { icon: 'calendar', tone: 'blue', en: 'Last 7 days', ar: 'آخر 7 أيام', value: n(r.week) },
        { icon: 'truck', tone: 'success', en: 'Order updates (7 days)', ar: 'تحديثات الطلبات (7 أيام)', href: '/admin/orders', value: n(r.orders) },
        { icon: 'boxes', tone: 'gold', en: 'Stock & product changes (7 days)', ar: 'تعديلات مخزون ومنتجات (7 أيام)', value: n(r.stock) },
        { icon: 'database', tone: 'violet', en: 'All events', ar: 'كل الأحداث', value: n(r.total) },
      ];
    }
    case 'backup': {
      const r = await one(sql`select (select count(*) from orders) orders, (select count(*) from products) products, (select count(*) from customers) customers, (select coalesce(sum(size),0) from media) media,
        (select max(created_at) from activity_log where action = 'backup') last`);
      return [
        { icon: 'clock', tone: r.last ? 'success' : 'danger', en: 'Last backup', ar: 'آخر نسخة احتياطية', value: r.last ? Math.floor((Date.now() - new Date(String(r.last)).getTime()) / 86400000) : 0, noteEn: r.last ? `days ago · ${day(r.last)}` : 'never — create one now', noteAr: r.last ? `يوم مضى · ${day(r.last)}` : 'ما انسوت أبداً — سوّ وحدة هسه' },
        { icon: 'truck', tone: 'accent', en: 'Orders', ar: 'الطلبات', value: n(r.orders) },
        { icon: 'boxes', tone: 'blue', en: 'Products', ar: 'المنتجات', value: n(r.products) },
        { icon: 'users', tone: 'gold', en: 'Customers', ar: 'العملاء', value: n(r.customers) },
        { icon: 'image', tone: 'violet', en: 'Media size', ar: 'حجم الوسائط', value: n(r.media), format: 'bytes' },
      ];
    }
    case 'content': {
      const r = await one(sql`select count(*) total, count(*) filter (where published) published, count(*) filter (where title_ar = '') noar, max(updated_at) last from content_pages`);
      return [
        { icon: 'file', tone: 'accent', en: 'Pages', ar: 'الصفحات', value: n(r.total) },
        { icon: 'eye', tone: 'success', en: 'Published', ar: 'منشورة', value: n(r.published) },
        { icon: 'alert', tone: 'gold', en: 'Missing Arabic title', ar: 'بدون عنوان عربي', value: n(r.noar) },
        { icon: 'clock', tone: 'blue', en: 'Last edit', ar: 'آخر تعديل', value: r.last ? Math.floor((Date.now() - new Date(String(r.last)).getTime()) / 86400000) : 0, noteEn: 'days ago', noteAr: 'يوم مضى' },
      ];
    }
    case 'seo': {
      const s = await getSettings();
      const r = await one(sql`select count(*) filter (where published) live,
        count(*) filter (where published and description = '' and description_ar = '') nodesc,
        (select count(*) from url_redirects where active) redirects,
        (select count(*) from categories where active) cats from products`);
      return [
        { icon: 'search', tone: s.seoIndex ? 'success' : 'danger', en: 'Search indexing', ar: 'الأرشفة بمحركات البحث', value: s.seoIndex ? 1 : 0, noteEn: s.seoIndex ? 'on' : 'off — the store is hidden from Google', noteAr: s.seoIndex ? 'مفعلة' : 'مطفية — المتجر مخفي عن كوكل' },
        { icon: 'file', tone: 'accent', en: 'Pages in the sitemap', ar: 'صفحات بخريطة الموقع', value: n(r.live) + n(r.cats) + 1 },
        { icon: 'alert', tone: 'gold', en: 'Products without a description', ar: 'منتجات بدون وصف', value: n(r.nodesc), href: '/admin/products' },
        { icon: 'link', tone: 'blue', en: 'Active redirects', ar: 'تحويلات فعالة', value: n(r.redirects), href: '/admin/redirects' },
        { icon: 'shield', tone: s.canonicalBaseUrl ? 'success' : 'danger', en: 'Main domain', ar: 'الدومين الأساسي', value: s.canonicalBaseUrl ? 1 : 0, noteEn: s.canonicalBaseUrl || 'not set', noteAr: s.canonicalBaseUrl || 'غير محدد' },
      ];
    }
    case 'navigation': case 'footer': case 'homepage': {
      const s = await getSettings();
      if (page === 'navigation') {
        const menus = s.navigation ?? [];
        return [
          { icon: 'menu', tone: 'accent', en: 'Menu sections', ar: 'أقسام القائمة', value: menus.length },
          { icon: 'link', tone: 'blue', en: 'Links', ar: 'الروابط', value: menus.reduce((sum, m) => sum + (m.links?.length ?? 0), 0) },
          { icon: 'alert', tone: 'gold', en: 'Links missing Arabic', ar: 'روابط بدون عربي', value: menus.reduce((sum, m) => sum + (m.links ?? []).filter(l => !l.labelAr || l.labelAr === l.label).length, 0) },
        ];
      }
      if (page === 'footer') {
        const f = s.footer;
        return [
          { icon: 'menu', tone: 'accent', en: 'Columns', ar: 'الأعمدة', value: f.groups.length },
          { icon: 'link', tone: 'blue', en: 'Links', ar: 'الروابط', value: f.groups.reduce((sum, g) => sum + g.links.length, 0) },
          { icon: 'check', tone: 'success', en: 'Trust messages shown', ar: 'رسائل ثقة ظاهرة', value: f.trustItems.filter(t => t.active).length },
          { icon: 'mail', tone: f.newsletter.active ? 'success' : 'gold', en: 'Newsletter box', ar: 'صندوق الاشتراك', value: f.newsletter.active ? 1 : 0, noteEn: f.newsletter.active ? 'shown' : 'hidden', noteAr: f.newsletter.active ? 'ظاهر' : 'مخفي' },
        ];
      }
      const h = s.homepage as typeof s.homepage & { blocks?: { enabled: boolean }[] };
      const blocks = h.blocks ?? [];
      return [
        { icon: 'layers', tone: 'accent', en: 'Sections shown', ar: 'أقسام ظاهرة', value: blocks.filter(b => b.enabled).length, noteEn: `of ${blocks.length}`, noteAr: `من ${blocks.length}`, href: '/admin/sections' },
        { icon: 'folder', tone: 'blue', en: 'Category tiles', ar: 'مربعات التصنيفات', value: h.categories.filter(c => c.active).length },
        { icon: 'boxes', tone: 'success', en: 'Collections shown', ar: 'مجموعات ظاهرة', value: h.collections.filter(c => c.active).length, href: '/admin/collections' },
        { icon: 'image', tone: 'violet', en: 'Social photos', ar: 'صور السوشيال', value: h.social.filter(c => c.active).length },
      ];
    }
    case 'settings': {
      const s = await getSettings();
      return [
        { icon: 'coins', tone: 'accent', en: 'Exchange rate (1 USD)', ar: 'سعر الصرف (1 دولار)', value: s.exchangeRate, noteEn: 'IQD', noteAr: 'دينار' },
        { icon: 'tag', tone: 'success', en: 'Free delivery from', ar: 'التوصيل المجاني من', value: s.freeShippingThreshold, format: 'iqd', href: '/admin/shipping' },
        { icon: 'wallet', tone: 'blue', en: 'Cash-on-delivery fee', ar: 'رسوم الدفع عند الاستلام', value: s.codFee, format: 'iqd' },
        { icon: 'alert', tone: 'gold', en: 'Low stock alert at', ar: 'تنبيه المخزون عند', value: s.lowStockThreshold, noteEn: 'units or less', noteAr: 'قطع أو أقل' },
      ];
    }
  }
}
