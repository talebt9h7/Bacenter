'use client';

import Link from 'next/link';
import { AlertTriangle, ArrowRight, Boxes, ExternalLink, Layers, Mail, MapPin, MessageSquare, Package, ShoppingCart, TrendingUp, Wallet } from 'lucide-react';
import { useLanguage } from '@/components/language-provider';
import { adminT } from '@/lib/i18n';
import { iqd, money, when } from '@/lib/format';
import { StatusBadge } from '@/components/admin/status-badge';

const T = {
  'Good to see you.': { ar: 'سعيد برؤيتك.', en: 'Good to see you.' },
  'Sales, fulfilment and stock at a glance. Product revenue excludes delivery charges. Delivery is live for {n} of 18 governorates.': { ar: 'المبيعات والتنفيذ والمخزون في لمحة سريعة. إيرادات المنتجات لا تشمل رسوم التوصيل. التوصيل متاح حالياً في {n} من أصل 18 محافظة.', en: 'Sales, fulfilment and stock at a glance. Product revenue excludes delivery charges. Delivery is live for {n} of 18 governorates.' },
  'New product': { ar: 'منتج جديد', en: 'New product' }, Orders: { ar: 'الطلبات', en: 'Orders' },
  'Product revenue': { ar: 'إيرادات المنتجات', en: 'Product revenue' },
  'Delivery excluded': { ar: 'التوصيل غير مشمول', en: 'Delivery excluded' },
  'Net product profit': { ar: 'صافي ربح المنتجات', en: 'Net product profit' },
  'Partial · {n} units have unknown cost': { ar: 'جزئي · تكلفة {n} وحدة غير معروفة', en: 'Partial · {n} units have unknown cost' },
  'Revenue − product cost': { ar: 'الإيرادات − تكلفة المنتجات', en: 'Revenue − product cost' },
  'Recognized on delivery · Revenue − product cost': { ar: 'يُحتسب عند التسليم · الإيرادات − تكلفة المنتجات', en: 'Recognized on delivery · Revenue − product cost' },
  'Delivery collected': { ar: 'رسوم التوصيل المحصلة', en: 'Delivery collected' },
  'Kept separate from revenue': { ar: 'تبقى منفصلة عن الإيرادات', en: 'Kept separate from revenue' },
  Today: { ar: 'اليوم', en: 'Today' },
  '{n} order today · products only': { ar: '{n} طلب اليوم · المنتجات فقط', en: '{n} order today · products only' },
  '{n} orders today · products only': { ar: '{n} طلبات اليوم · المنتجات فقط', en: '{n} orders today · products only' },
  'Needs action': { ar: 'يحتاج إجراء', en: 'Needs action' },
  'pending · confirmed · processing': { ar: 'قيد الانتظار · مؤكد · قيد التجهيز', en: 'pending · confirmed · processing' },
  'Units in stock': { ar: 'الوحدات في المخزون', en: 'Units in stock' },
  '{sold} sold out · {low} low': { ar: '{sold} نفدت · {low} منخفض', en: '{sold} sold out · {low} low' },
  '{colors} colors · {live} live': { ar: '{colors} ألوان · {live} منشور', en: '{colors} colors · {live} live' },
  '{subs} subscribers': { ar: '{subs} مشترك', en: '{subs} subscribers' },
  'Last 14 days': { ar: 'آخر 14 يوماً', en: 'Last 14 days' },
  '{n} orders': { ar: '{n} طلب', en: '{n} orders' },
  'Orders by governorate': { ar: 'الطلبات حسب المحافظة', en: 'Orders by governorate' },
  Governorate: { ar: 'المحافظة', en: 'Governorate' }, Revenue: { ar: 'الإيرادات', en: 'Revenue' },
  'Delivery rates': { ar: 'أسعار التوصيل', en: 'Delivery rates' },
  'No orders yet.': { ar: 'لا توجد طلبات حتى الآن.', en: 'No orders yet.' },
  'Recent orders': { ar: 'آخر الطلبات', en: 'Recent orders' }, Customer: { ar: 'العميل', en: 'Customer' }, Status: { ar: 'الحالة', en: 'Status' }, 'All orders': { ar: 'كل الطلبات', en: 'All orders' },
  'Stock attention': { ar: 'تنبيه المخزون', en: 'Stock attention' }, Product: { ar: 'المنتج', en: 'Product' }, Color: { ar: 'اللون', en: 'Color' }, Stock: { ar: 'المخزون', en: 'Stock' }, Inventory: { ar: 'المخزون', en: 'Inventory' }, 'Sold out': { ar: 'نفد المخزون', en: 'Sold out' }, 'left': { ar: 'متبقي', en: 'left' }, 'Every color is comfortably stocked.': { ar: 'جميع الألوان متوفرة بمستوى مخزون جيد.', en: 'Every color is comfortably stocked.' },
  'Recent activity': { ar: 'آخر النشاطات', en: 'Recent activity' }, 'Actions you take in the admin will appear here.': { ar: 'الإجراءات التي تنفذها في لوحة الإدارة ستظهر هنا.', en: 'Actions you take in the admin will appear here.' },
  'Quick links': { ar: 'روابط سريعة', en: 'Quick links' }, 'Banners & hero slides': { ar: 'البانرات وشرائح الواجهة', en: 'Banners & hero slides' }, 'Pages & homepage copy': { ar: 'الصفحات ومحتوى الصفحة الرئيسية', en: 'Pages & homepage copy' }, 'Discount codes': { ar: 'أكواد الخصم', en: 'Discount codes' }, 'Iraq delivery rates': { ar: 'أسعار التوصيل في العراق', en: 'Iraq delivery rates' }, 'Store settings': { ar: 'إعدادات المتجر', en: 'Store settings' },
};
function tx(key: keyof typeof T, language: 'en'|'ar', vars: Record<string,string|number> = {}) {
  let value = T[key]?.[language] ?? key;
  for (const [k,v] of Object.entries(vars)) value = value.replace(`{${k}}`, String(v));
  return value;
}

type Props = {
  storeName: string;
  governorateCount: number;
  stats: Array<{ label: string; value: string|number; note: string; icon: string; href?: string }>;
  days: Array<{ key: string; label: string; total: number; revenue: number }>;
  maxRevenue: number;
  byGovernorate: Array<{ governorate: string; total: number; revenue: number }>;
  zoneNames: Array<{ code: string; nameEn: string }>;
  recentOrders: any[];
  stockItems: Array<{ productName: string; color: { id: number; name: string; hex: string; stock: number; images: any[] } }>;
  recentActivity: any[];
};

export function DashboardClient({ storeName, governorateCount, stats, days, maxRevenue, byGovernorate, zoneNames, recentOrders, stockItems, recentActivity }: Props) {
  const { language } = useLanguage();
  const tr = (label: keyof typeof T, vars?: Record<string,string|number>) => tx(label, language, vars);
  const statLabel = (label: string) => {
    const key = label as keyof typeof T;
    return T[key] ? tx(key, language) : label;
  };
  const statIcon = (name: string) => ({ Wallet, TrendingUp, Package, ShoppingCart, Boxes, MessageSquare }[name] ?? Package);
  const statNote = (note: string) => {
    if (note === 'Kept separate from revenue' || note === 'Revenue − product cost' || note === 'Recognized on delivery · Revenue − product cost' || note === 'Delivery excluded' || note === 'pending · confirmed · processing') return tx(note as keyof typeof T, language);
    const m = note.match(/^(\d+) live orders · delivery excluded$/); if (m) return language === 'ar' ? `${m[1]} طلب مباشر · التوصيل غير مشمول` : note;
    const m2 = note.match(/^Partial · (\d+) units have unknown cost$/); if (m2) return tx('Partial · {n} units have unknown cost', language, {n:m2[1]});
    const m3 = note.match(/^(\d+) order(s)? today · products only$/); if (m3) return tx(m3[2] ? '{n} orders today · products only' : '{n} order today · products only', language, {n:m3[1]});
    const m4 = note.match(/^(\d+) sold out · (\d+) low$/); if (m4) return tx('{sold} sold out · {low} low', language, {sold:m4[1],low:m4[2]});
    const m5 = note.match(/^(\d+) colors · (\d+) live$/); if (m5) return tx('{colors} colors · {live} live', language, {colors:m5[1],live:m5[2]});
    const m6 = note.match(/^pending · confirmed · processing$/); if (m6) return tx('pending · confirmed · processing', language);
    const m7 = note.match(/^(\d+) subscribers$/); if (m7) return tx('{subs} subscribers', language, {subs:m7[1]});
    return note;
  };
  const zoneName = (code: string) => zoneNames.find(z => z.code === code)?.nameEn ?? code ?? '—';
  return <main className="admin-page"><div className="admin-page-heading"><div><span className="admin-eyebrow">{language === 'ar' ? `نظرة عامة · ${storeName}` : `Overview · ${storeName}`}</span><h1>{tr('Good to see you.')}</h1><p>{tr('Sales, fulfilment and stock at a glance. Product revenue excludes delivery charges. Delivery is live for {n} of 18 governorates.', {n: governorateCount})}</p></div><div className="admin-heading-actions"><Link href="/admin/orders" className="admin-btn admin-btn-ghost">{tr('Orders')} <ArrowRight size={15} /></Link><Link href="/admin/products/new" className="admin-btn admin-btn-primary">{tr('New product')} <ArrowRight size={16} /></Link></div></div>
    <div className="admin-stats">{stats.map((stat, i) => { const body = <>{(() => { const Icon = statIcon(stat.icon); return <Icon size={20} strokeWidth={1.5} />; })()}<strong>{stat.value}</strong><span>{statLabel(stat.label)}</span><small>{statNote(stat.note)}</small></>; return stat.href ? <Link href={stat.href} className="admin-stat admin-stat-link" key={`${stat.label}-${i}`}>{body}</Link> : <div className="admin-stat" key={`${stat.label}-${i}`}>{body}</div>; })}</div>
    <div className="admin-grid-2">
      <section className="admin-card"><div className="admin-card-heading"><h2><TrendingUp size={17} /> {tr('Last 14 days')}</h2><span className="admin-count">{iqd(days.reduce((sum, day) => sum + day.revenue, 0))} · {tr('{n} orders', {n: days.reduce((sum, day) => sum + day.total, 0)})}</span></div><div className="admin-chart" role="img" aria-label={tr('Last 14 days')}>{days.map(day => <div key={day.key} className="admin-chart-col" title={`${day.key}: ${day.total} orders · ${iqd(day.revenue)}`}><i style={{ height: `${Math.max(day.revenue / maxRevenue * 100, day.total ? 4 : 1)}%` }} /><span>{day.label}</span></div>)}</div></section>
      <section className="admin-card"><div className="admin-card-heading"><h2><MapPin size={17} /> {tr('Orders by governorate')}</h2><Link href="/admin/shipping" className="admin-link">{tr('Delivery rates')} <ArrowRight size={14} /></Link></div>{byGovernorate.length ? <table className="admin-table"><thead><tr><th>{tr('Governorate')}</th><th className="num">{tr('Orders')}</th><th className="num">{tr('Revenue')}</th></tr></thead><tbody>{byGovernorate.map(row => <tr key={row.governorate}><td>{zoneName(row.governorate)}</td><td className="num">{Number(row.total)}</td><td className="num">{iqd(Number(row.revenue ?? 0))}</td></tr>)}</tbody></table> : <p className="admin-empty">{tr('No orders yet.')}</p>}</section>
      <section className="admin-card"><div className="admin-card-heading"><h2><ShoppingCart size={17} /> {tr('Recent orders')}</h2><Link href="/admin/orders" className="admin-link">{tr('All orders')} <ArrowRight size={14} /></Link></div>{recentOrders.length ? <table className="admin-table"><thead><tr><th>{tr('Orders')}</th><th>{tr('Customer')}</th><th className="num">{tr('Revenue')}</th><th>{tr('Status')}</th></tr></thead><tbody>{recentOrders.map(order => <tr key={order.id}><td><Link href={`/admin/orders/${order.id}`} className="admin-strong-link">{order.reference}</Link><br /><small>{when(order.createdAt)}</small></td><td>{order.name}<br /><small>{order.phone || order.email}</small></td><td className="num">{money(order.totalCents, order.currency)}</td><td><StatusBadge status={order.status} /></td></tr>)}</tbody></table> : <p className="admin-empty">{tr('No orders yet.')}</p>}</section>
      <section className="admin-card"><div className="admin-card-heading"><h2><AlertTriangle size={17} /> {tr('Stock attention')}</h2><Link href="/admin/inventory" className="admin-link">{tr('Inventory')} <ArrowRight size={14} /></Link></div>{stockItems.length ? <table className="admin-table"><thead><tr><th>{tr('Product')}</th><th>{tr('Color')}</th><th className="num">{tr('Stock')}</th></tr></thead><tbody>{stockItems.map(item => <tr key={item.color.id}><td>{item.productName}</td><td><span className="admin-swatch" style={{ background: item.color.hex }} /> {item.color.name}</td><td className="num">{item.color.stock === 0 ? <span className="admin-badge danger">{tr('Sold out')}</span> : <span className="admin-badge warning">{item.color.stock} {tr('left')}</span>}</td></tr>)}</tbody></table> : <p className="admin-empty">{tr('Every color is comfortably stocked.')}</p>}</section>
    </div>
    <div className="admin-grid-2"><section className="admin-card"><div className="admin-card-heading"><h2><Layers size={17} /> {tr('Recent activity')}</h2></div>{recentActivity.length ? <ul className="admin-activity">{recentActivity.map(item => <li key={item.id}><span>{when(item.createdAt)}</span><strong>{item.action}</strong> {item.entity}{item.entityId ? ` #${item.entityId}` : ''}{item.details ? <small> — {item.details}</small> : null}</li>)}</ul> : <p className="admin-empty">{tr('Actions you take in the admin will appear here.')}</p>}</section>
      <section className="admin-card"><div className="admin-card-heading"><h2><Mail size={17} /> {tr('Quick links')}</h2></div><div className="admin-quick-links">{[['/admin/banners', 'Banners & hero slides'], ['/admin/content', 'Pages & homepage copy'], ['/admin/coupons', 'Discount codes'], ['/admin/shipping', 'Iraq delivery rates'], ['/admin/customers', 'Customers'], ['/admin/settings', 'Store settings']].map(([href, label]) => <Link key={href} href={href}>{tr(label as keyof typeof T)} <ArrowRight size={13} /></Link>)}</div></section></div>
  </main>;
}
