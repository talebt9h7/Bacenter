import { redirect } from 'next/navigation';
import { requireAdminSection } from '@/lib/admin-auth';
import Link from 'next/link';
import { count, desc, eq, inArray, sql } from 'drizzle-orm';
import { AlertTriangle, ArrowRight, Boxes, Layers, Mail, MapPin, MessageSquare, Package, ShoppingCart, TrendingUp, Wallet } from 'lucide-react';
import { db } from '@/db';
import { activityLog, newsletterSubscribers, orders, shippingZones, supportMessages } from '@/db/schema';
import { getAllProducts } from '@/lib/products';
import { getSettings } from '@/lib/settings';
import { primaryImage } from '@/lib/types';
import { iqd, money, when } from '@/lib/format';
import { orderProductProfit } from '@/lib/orders';
import { StatusBadge } from '@/components/admin/status-badge';
import { DashboardClient } from '@/components/admin/dashboard-client';

export const metadata = { title: 'Dashboard' };
export default async function AdminDashboard() {
  const actor = await requireAdminSection('overview', 'view');
  if (!actor) redirect('/admin');
  const settings = await getSettings();
  const products = await getAllProducts({ includeUnpublished: true });
  const since = new Date(); since.setDate(since.getDate() - 13); since.setHours(0, 0, 0, 0);
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const [allLiveOrders, pendingCount, subscribers, openMessages, recentOrders, recentActivity, zones] = await Promise.all([
    db.select({ id: orders.id, items: orders.items, currency: orders.currency, status: orders.status, createdAt: orders.createdAt, governorate: orders.governorate, shippingCents: orders.shippingCents, discountCents: orders.discountCents }).from(orders).where(eq(orders.status, 'delivered')),
    db.select({ total: count() }).from(orders).where(inArray(orders.status, ['pending', 'confirmed', 'processing'])),
    db.select({ total: count() }).from(newsletterSubscribers),
    db.select({ total: count() }).from(supportMessages).where(sql`${supportMessages.status} = 'open'`),
    db.select().from(orders).orderBy(desc(orders.createdAt)).limit(8),
    db.select().from(activityLog).orderBy(desc(activityLog.createdAt)).limit(8),
    db.select().from(shippingZones),
  ]);
  const liveOrders = allLiveOrders.filter(order => order.currency === 'IQD');
  const finite = (value: unknown, fallback = 0) => { const n = Number(value); return Number.isFinite(n) ? n : fallback; };
  const orderItems = (order: typeof liveOrders[number]) => Array.isArray(order.items) ? order.items as { quantity: number; unitPrice?: number; purchaseCostCents?: number | null }[] : [];
  const productGrossRevenue = (order: typeof liveOrders[number]) => order.status === 'delivered' ? orderItems(order).reduce((sum, item) => sum + finite(item.unitPrice) * finite(item.quantity), 0) : 0;
  const productRevenue = (order: typeof liveOrders[number]) => Math.max(0, productGrossRevenue(order) - finite(order.discountCents));
  const knownProfit = (order: typeof liveOrders[number]) => {
    if (order.status !== 'delivered') return 0;
    return orderProductProfit(orderItems(order), finite(order.discountCents));
  };
  const unknownCostUnits = (order: typeof liveOrders[number]) => orderItems(order).filter(item => item.purchaseCostCents == null).reduce((sum, item) => sum + item.quantity, 0);
  const totals = { total: liveOrders.length, revenue: liveOrders.reduce((sum, order) => sum + productRevenue(order), 0), delivery: liveOrders.reduce((sum, order) => sum + finite(order.shippingCents), 0), profit: liveOrders.reduce((sum, order) => sum + finite(knownProfit(order)), 0), unknownCostUnits: liveOrders.reduce((sum, order) => sum + finite(unknownCostUnits(order)), 0) };
  const todayOrders = liveOrders.filter(order => new Date(order.createdAt) >= today);
  const todayStats = { total: todayOrders.length, revenue: todayOrders.reduce((sum, order) => sum + productRevenue(order), 0) };
  const dailyMap = new Map<string, { total: number; revenue: number }>();
  for (const order of liveOrders) { const key = new Date(order.createdAt).toISOString().slice(0, 10); if (key < since.toISOString().slice(0, 10)) continue; const current = dailyMap.get(key) ?? { total: 0, revenue: 0 }; current.total += 1; current.revenue += productRevenue(order); dailyMap.set(key, current); }
  const governorateMap = new Map<string, { total: number; revenue: number }>();
  for (const order of liveOrders) { const current = governorateMap.get(order.governorate) ?? { total: 0, revenue: 0 }; current.total += 1; current.revenue += productRevenue(order); governorateMap.set(order.governorate, current); }
  const byGovernorate = [...governorateMap.entries()].sort((a,b) => b[1].total-a[1].total).slice(0,8).map(([governorate,value]) => ({ governorate, ...value }));
  const daily = [...dailyMap.entries()].map(([day,value]) => ({ day, ...value }));
  const variants = products.flatMap(product => product.colors.map(color => ({ product, color })));
  const units = variants.reduce((sum, item) => sum + finite(item.color.stock), 0);
  const lowStock = variants.filter(item => { const stock = finite(item.color.stock); return stock > 0 && stock <= finite(settings.lowStockThreshold); });
  const soldOut = variants.filter(item => finite(item.color.stock) === 0);
  const days = Array.from({ length: 14 }, (_, index) => { const date = new Date(since); date.setDate(since.getDate() + index); const key = date.toISOString().slice(0, 10); const row = daily.find(item => item.day === key); return { key, label: date.toLocaleDateString('en-GB', { weekday: 'short' }), total: Number(row?.total ?? 0), revenue: Number(row?.revenue ?? 0) }; });
  const maxRevenue = Math.max(...days.map(day => day.revenue), 1);
  const zoneName = (code: string) => zones.find(zone => zone.code === code)?.nameEn ?? code ?? '—';
  const stats = [
    { label: 'Product revenue', value: iqd(totals.revenue), note: `${totals.total} delivered orders · after discounts · delivery excluded`, icon: 'Wallet' },
    { label: 'Net product profit', value: iqd(totals.profit), note: totals.unknownCostUnits ? `Partial · ${totals.unknownCostUnits} delivered units have unknown cost` : 'Recognized on delivery · Revenue − product cost', icon: 'TrendingUp' },
    { label: 'Delivery collected', value: iqd(totals.delivery), note: 'Kept separate from revenue', icon: 'Package' },
    { label: 'Today', value: iqd(todayStats.revenue), note: `${todayStats.total} order${todayStats.total === 1 ? '' : 's'} today · products only`, icon: 'TrendingUp' },
    { label: 'Needs action', value: finite(pendingCount.total), note: 'pending · confirmed · processing', icon: 'ShoppingCart', href: '/admin/orders' },
    { label: 'Units in stock', value: units.toLocaleString('en-US'), note: `${soldOut.length} sold out · ${lowStock.length} low`, icon: 'Boxes', href: '/admin/inventory' },
    { label: 'Products', value: products.length, note: `${variants.length} colors · ${products.filter(p => p.published).length} live`, icon: 'Package', href: '/admin/products' },
    { label: 'Inbox', value: finite(openMessages.total), note: `${finite(subscribers.total)} subscribers`, icon: 'MessageSquare', href: '/admin/messages' },
  ];
  return <DashboardClient
    storeName={settings.storeName}
    governorateCount={zones.filter(zone => zone.enabled).length}
    stats={stats}
    days={days}
    maxRevenue={maxRevenue}
    byGovernorate={byGovernorate}
    zoneNames={zones.map(zone => ({ code: zone.code, nameEn: zone.nameEn }))}
    recentOrders={recentOrders}
    stockItems={[...soldOut, ...lowStock].slice(0, 8).map(item => ({ productName: item.product.name, color: { id: item.color.id, name: item.color.name, hex: item.color.hex, stock: item.color.stock, images: item.color.images }}))}
    recentActivity={recentActivity}
  />;
}
