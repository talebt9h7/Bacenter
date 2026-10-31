'use client';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';
import { CornerDownLeft, LoaderCircle, Package, Search, ShoppingCart, User, X } from 'lucide-react';

export type PaletteLink = { href: string; label: string; group: string; icon: React.ComponentType<{ size?: number; strokeWidth?: number }> };
type Results = {
  orders: { id: number; reference: string; name: string; phone: string; status: string; total: number }[];
  products: { id: string; name: string; nameAr: string; price: number; published: boolean }[];
  customers: { id: number; name: string; phone: string; ordersCount: number }[];
};
type Item = { key: string; href: string; title: string; meta: string; kind: 'page' | 'order' | 'product' | 'customer'; Icon: React.ComponentType<{ size?: number; strokeWidth?: number }> };

const STATUS_AR: Record<string, string> = { pending: 'قيد الانتظار', confirmed: 'مؤكد', processing: 'قيد التجهيز', shipped: 'تم الشحن', delivered: 'تم التوصيل', cancelled: 'ملغي', returned: 'مرتجع' };

/**
 * ⌘K / Ctrl+K search across the admin: jump to any page, or find an order (number, phone, name),
 * a product or a customer. Arrow keys move, Enter opens, Esc closes.
 */
export function CommandPalette({ links, ar, open, onOpenChange }: { links: PaletteLink[]; ar: boolean; open: boolean; onOpenChange: (open: boolean) => void }) {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Results | null>(null);
  const [loading, setLoading] = useState(false);
  const [index, setIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      const typing = !!target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable);
      if ((event.key === 'k' || event.key === 'K') && (event.metaKey || event.ctrlKey)) { event.preventDefault(); onOpenChange(!open); }
      else if (event.key === '/' && !typing && !open) { event.preventDefault(); onOpenChange(true); }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onOpenChange]);

  useEffect(() => {
    if (!open) return;
    const frame = requestAnimationFrame(() => inputRef.current?.focus());
    const original = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { cancelAnimationFrame(frame); document.body.style.overflow = original; };
  }, [open]);

  const trimmed = query.trim();
  useEffect(() => {
    if (trimmed.length < 2) return;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setLoading(true);
      try { const r = await fetch(`/api/admin/search?q=${encodeURIComponent(trimmed)}`, { signal: controller.signal }); if (r.ok) setResults(await r.json()); }
      catch { /* aborted or offline */ }
      finally { setLoading(false); }
    }, 180);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [trimmed]);

  const items: Item[] = useMemo(() => {
    const q = trimmed.toLowerCase();
    const pages = links.filter(l => !q || l.label.toLowerCase().includes(q) || l.group.toLowerCase().includes(q) || l.href.includes(q)).slice(0, q ? 6 : 10)
      .map(l => ({ key: `p:${l.href}`, href: l.href, title: l.label, meta: l.group, kind: 'page' as const, Icon: l.icon }));
    if (trimmed.length < 2 || !results) return pages;
    const money = (n: number) => `${n.toLocaleString('en-US')} ${ar ? 'د.ع' : 'IQD'}`;
    return [
      ...results.orders.map(o => ({ key: `o:${o.id}`, href: `/admin/orders/${o.id}`, title: `${o.reference} · ${o.name}`, meta: `${o.phone} · ${ar ? STATUS_AR[o.status] ?? o.status : o.status} · ${money(o.total)}`, kind: 'order' as const, Icon: ShoppingCart })),
      ...results.customers.map(c => ({ key: `c:${c.id}`, href: `/admin/customers/${c.id}`, title: c.name, meta: `${c.phone} · ${ar ? `${c.ordersCount} طلب` : `${c.ordersCount} orders`}`, kind: 'customer' as const, Icon: User })),
      ...results.products.map(p => ({ key: `r:${p.id}`, href: `/admin/products/${p.id}`, title: ar ? p.nameAr || p.name : p.name, meta: `${money(p.price)}${p.published ? '' : ar ? ' · مسودة' : ' · draft'}`, kind: 'product' as const, Icon: Package })),
      ...pages,
    ];
  }, [links, trimmed, results, ar]);

  const safeIndex = Math.min(index, Math.max(items.length - 1, 0));
  useEffect(() => { listRef.current?.querySelector<HTMLElement>(`[data-index="${safeIndex}"]`)?.scrollIntoView({ block: 'nearest' }); }, [safeIndex]);

  function close() { onOpenChange(false); setQuery(''); setResults(null); setIndex(0); }
  function go(item?: Item) { if (!item) return; close(); router.push(item.href); }
  function onInputKey(event: React.KeyboardEvent) {
    if (event.key === 'ArrowDown') { event.preventDefault(); setIndex(i => Math.min(i + 1, items.length - 1)); }
    else if (event.key === 'ArrowUp') { event.preventDefault(); setIndex(i => Math.max(i - 1, 0)); }
    else if (event.key === 'Enter') { event.preventDefault(); go(items[safeIndex]); }
    else if (event.key === 'Escape') { event.preventDefault(); close(); }
  }
  if (!open) return null;

  const heading: Record<Item['kind'], string> = ar ? { order: 'الطلبات', customer: 'العملاء', product: 'المنتجات', page: 'الصفحات' } : { order: 'Orders', customer: 'Customers', product: 'Products', page: 'Pages' };
  return <div className="cmdk-overlay" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) close(); }}>
    <div className="cmdk" role="dialog" aria-modal="true" aria-label={ar ? 'بحث سريع' : 'Quick search'}>
      <div className="cmdk-input"><Search size={18} />
        <input ref={inputRef} value={query} onChange={e => { setQuery(e.target.value); setIndex(0); }} onKeyDown={onInputKey} placeholder={ar ? 'ابحث عن طلب، رقم هاتف، عميل، منتج أو صفحة…' : 'Search orders, phone numbers, customers, products or pages…'} aria-label={ar ? 'بحث' : 'Search'} />
        {loading ? <LoaderCircle size={16} className="spin" /> : query ? <button type="button" aria-label={ar ? 'مسح' : 'Clear'} onClick={() => { setQuery(''); setResults(null); inputRef.current?.focus(); }}><X size={16} /></button> : <kbd>Esc</kbd>}
      </div>
      <div className="cmdk-list" ref={listRef} role="listbox">
        {items.length === 0 && <p className="cmdk-empty">{trimmed.length >= 2 && !loading ? (ar ? 'ما لكينا نتائج.' : 'No results.') : (ar ? 'اكتب حرفين أو أكثر…' : 'Type at least two characters…')}</p>}
        {items.map((item, i) => {
          const showHeading = i === 0 || items[i - 1].kind !== item.kind;
          return <div key={item.key}>
            {showHeading && <div className="cmdk-heading">{heading[item.kind]}</div>}
            <button type="button" role="option" aria-selected={i === safeIndex} data-index={i} className={`cmdk-item ${i === safeIndex ? 'active' : ''}`} onMouseMove={() => setIndex(i)} onClick={() => go(item)}>
              <item.Icon size={16} strokeWidth={1.7} /><span className="cmdk-title">{item.title}</span><span className="cmdk-meta">{item.meta}</span>{i === safeIndex && <CornerDownLeft size={14} className="cmdk-enter" />}
            </button>
          </div>;
        })}
      </div>
      <div className="cmdk-foot"><span><kbd>↑</kbd><kbd>↓</kbd> {ar ? 'للتنقل' : 'to move'}</span><span><kbd>Enter</kbd> {ar ? 'للفتح' : 'to open'}</span><span><kbd>Ctrl</kbd>+<kbd>K</kbd> {ar ? 'من أي مكان' : 'from anywhere'}</span></div>
    </div>
  </div>;
}
