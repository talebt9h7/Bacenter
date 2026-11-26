'use client';

/** Compact date filter for the orders list: quick presets plus a from/to popover (Baghdad days). */
import { useEffect, useRef, useState } from 'react';
import { CalendarDays, X } from 'lucide-react';

const shift = (day: string, n: number) => { const d = new Date(`${day}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };

export function OrdersDateFilter({ fromDay, toDay, today, ar, onChange }: { fromDay: string; toDay: string; today: string; ar: boolean; onChange: (from: string, to: string) => void }) {
  const L = (a: string, e: string) => ar ? a : e;
  const presets = [
    { key: 'all', label: L('كل الأيام', 'All time'), from: '', to: '' },
    { key: 'today', label: L('اليوم', 'Today'), from: today, to: today },
    { key: 'yesterday', label: L('أمس', 'Yesterday'), from: shift(today, -1), to: shift(today, -1) },
    { key: '7d', label: L('7 أيام', '7 days'), from: shift(today, -6), to: today },
    { key: '30d', label: L('30 يوم', '30 days'), from: shift(today, -29), to: today },
  ];
  const active = presets.find(p => p.from === fromDay && p.to === toDay)?.key ?? 'custom';
  const [open, setOpen] = useState(false);
  const [a, setA] = useState(fromDay || today), [b, setB] = useState(toDay || today);
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => { if (!open) return; const off = (e: MouseEvent) => { if (!box.current?.contains(e.target as Node)) setOpen(false); }; document.addEventListener('mousedown', off); return () => document.removeEventListener('mousedown', off); }, [open]);
  const fmt = (d: string) => d ? new Date(`${d}T12:00:00Z`).toLocaleDateString(ar ? 'ar-IQ-u-nu-latn' : 'en-GB', { day: 'numeric', month: 'short' }) : '…';
  const customLabel = active === 'custom' ? (fromDay === toDay ? fmt(fromDay) : `${fmt(fromDay)} – ${fmt(toDay)}`) : L('تاريخ محدد', 'Pick dates');
  return <div className="od-filter" ref={box}>
    <div className="admin-segmented od-presets" role="tablist" aria-label={L('فلتر التاريخ', 'Date filter')}>
      {presets.map(p => <button key={p.key} type="button" role="tab" aria-selected={active === p.key} className={active === p.key ? 'active' : ''} onClick={() => onChange(p.from, p.to)}>{p.label}</button>)}
      <button type="button" role="tab" aria-selected={active === 'custom'} className={`od-custom ${active === 'custom' ? 'active' : ''}`} onClick={() => { setA(fromDay || today); setB(toDay || today); setOpen(v => !v); }}><CalendarDays size={14} />{customLabel}</button>
    </div>
    {active === 'custom' && <button type="button" className="od-clear" onClick={() => onChange('', '')} aria-label={L('إلغاء فلتر التاريخ', 'Clear date filter')}><X size={13} /></button>}
    {open && <div className="od-pop" role="dialog">
      <label><span>{L('من', 'From')}</span><input type="date" value={a} max={today} onChange={e => { setA(e.target.value); if (b && e.target.value > b) setB(e.target.value); }} /></label>
      <label><span>{L('إلى', 'To')}</span><input type="date" value={b} min={a} max={today} onChange={e => setB(e.target.value)} /></label>
      <div className="od-pop-actions"><button type="button" className="admin-btn admin-btn-ghost admin-btn-sm" onClick={() => setB(a)}>{L('يوم واحد', 'Single day')}</button><button type="button" className="admin-btn admin-btn-primary admin-btn-sm" disabled={!a || !b} onClick={() => { setOpen(false); onChange(a, b); }}>{L('عرض', 'Show')}</button></div>
    </div>}
  </div>;
}
