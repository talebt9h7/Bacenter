'use client';

/**
 * Orders by governorate on a map of Iraq. Each governorate is shaded by how many orders it placed
 * in the period; hovering (or tapping) one shows its numbers in a card next to it. The busiest
 * governorate is selected at rest so the card is never empty.
 */
import { useMemo, useState } from 'react';
import { IRAQ_MAP, IRAQ_SHAPES } from '@/lib/iraq-map';
import { iraqGovernorates } from '@/lib/iraq';
import { compact, fmt, iqd, type Lang } from './dash-ui';

export type GovernorateStat = { key: string; nameEn: string; nameAr: string; placed: number; cancelled: number; delivered: number; revenue: number; units: number; topProduct: { name: string; nameAr: string; units: number } | null };

const EMPTY = '#eef0f3';
// Light clay to UR orange, by the square root of the share of the busiest governorate.
function shade(t: number) {
  const a = [246, 222, 210], b = [205, 76, 32];
  const k = Math.sqrt(Math.max(0, Math.min(1, t)));
  return `rgb(${a.map((v, i) => Math.round(v + (b[i] - v) * k)).join(',')})`;
}

export function GovernorateMap({ rows, lang }: { rows: GovernorateStat[]; lang: Lang }) {
  const ar = lang === 'ar';
  const tt = (en: string, arText: string) => ar ? arText : en;
  const byKey = useMemo(() => new Map(rows.map(r => [r.key, r])), [rows]);
  const mapped = rows.filter(r => r.key !== 'unknown' && IRAQ_SHAPES.some(s => s.code === r.key));
  const max = Math.max(1, ...mapped.map(r => r.placed));
  const busiest = [...mapped].sort((a, b) => b.placed - a.placed || b.revenue - a.revenue)[0];
  const [picked, setPicked] = useState<string | null>(null);
  const selected = picked ?? busiest?.key ?? null;
  const sel = selected ? byKey.get(selected) : undefined;
  const shape = IRAQ_SHAPES.find(s => s.code === selected);
  const name = (code: string) => { const g = iraqGovernorates.find(x => x.code === code); const r = byKey.get(code); return g ? (ar ? g.nameAr : g.nameEn.replace(/ \(.*\)$/, '')) : r ? (ar ? r.nameAr : r.nameEn) : code; };
  const unknown = byKey.get('unknown');

  const topRevenue = [...mapped].sort((a, b) => b.revenue - a.revenue)[0];
  const topUnits = [...mapped].sort((a, b) => b.units - a.units)[0];
  const ordering = mapped.filter(r => r.placed > 0).length;

  // Card beside the governorate (to its left when it sits on the right half, and the other way round), kept inside the box.
  const px = shape ? (shape.x / IRAQ_MAP.width) * 100 : 50, py = shape ? Math.min(82, Math.max(18, (shape.y / IRAQ_MAP.height) * 100)) : 50;
  const side = px > 50 ? 'start' : 'end';

  return <div className="gm">
    <div className="gm-stage">
      <svg viewBox={`0 0 ${IRAQ_MAP.width} ${IRAQ_MAP.height}`} role="group" aria-label={tt('Map of orders by governorate', 'خريطة الطلبات حسب المحافظة')}>
        {IRAQ_SHAPES.map(s => {
          const r = byKey.get(s.code);
          const fill = r && r.placed > 0 ? shade(r.placed / max) : EMPTY;
          const label = `${name(s.code)}: ${r?.placed ?? 0} ${tt('orders', 'طلب')}`;
          return <path key={s.code} d={s.d} fill={fill} className={`gm-region${s.code === selected ? ' on' : ''}`} tabIndex={0} role="button" aria-label={label} aria-pressed={s.code === selected}
            onMouseEnter={() => setPicked(s.code)} onFocus={() => setPicked(s.code)} onClick={() => setPicked(s.code)}><title>{label}</title></path>;
        })}
        {shape && <path d={shape.d} className="gm-outline" aria-hidden="true" />}
        {IRAQ_SHAPES.map(s => {
          const r = byKey.get(s.code);
          if (!r || r.placed <= 0) return null;
          const big = r.placed / max > 0.45;
          return <g key={`b-${s.code}`} className="gm-badge" aria-hidden="true" transform={`translate(${s.x} ${s.y})`}>
            <circle r={r.placed > 99 ? 22 : 18} className={big ? 'dark' : ''} />
            <text dy="7" textAnchor="middle" className={big ? 'dark' : ''}>{r.placed}</text>
          </g>;
        })}
      </svg>
      {sel && shape && <div className={`gm-tip ${side}`} style={{ left: `${px}%`, top: `${py}%` }} role="status" aria-live="polite">
        <strong>{name(sel.key)}</strong>
        <dl>
          <div><dt>{tt('Orders', 'الطلبات')}</dt><dd>{fmt(sel.placed)}{sel.cancelled ? <small> · {sel.cancelled} {tt('cancelled', 'ملغي')}</small> : null}</dd></div>
          <div><dt>{tt('Delivered', 'مُسلّمة')}</dt><dd>{fmt(sel.delivered)}</dd></div>
          <div><dt>{tt('Revenue', 'الإيراد')}</dt><dd>{iqd(sel.revenue)}</dd></div>
          <div><dt>{tt('Units sold', 'قطع مباعة')}</dt><dd>{fmt(sel.units)}</dd></div>
          <div><dt>{tt('Top product', 'الأكثر طلباً')}</dt><dd>{sel.topProduct ? `${ar ? sel.topProduct.nameAr : sel.topProduct.name} (${sel.topProduct.units})` : '—'}</dd></div>
        </dl>
      </div>}
      {selected && !sel && shape && <div className={`gm-tip ${side}`} style={{ left: `${px}%`, top: `${py}%` }} role="status"><strong>{name(selected)}</strong><p>{tt('No orders in this period.', 'ماكو طلبات بهالفترة.')}</p></div>}
    </div>
    <div className="gm-scale" aria-hidden="true"><span>{tt('Fewer orders', 'طلبات أقل')}</span><i /><span>{tt('More', 'أكثر')}</span></div>
    <div className="gm-stats">
      <div><span>{tt('Top revenue', 'الأعلى إيراداً')}</span><b>{topRevenue?.revenue ? `${name(topRevenue.key)} (${compact(topRevenue.revenue)})` : '—'}</b></div>
      <div><span>{tt('Most orders', 'الأكثر طلبات')}</span><b>{busiest?.placed ? `${name(busiest.key)} (${busiest.placed})` : '—'}</b></div>
      <div><span>{tt('Most units', 'الأكثر قطعاً')}</span><b>{topUnits?.units ? `${name(topUnits.key)} (${fmt(topUnits.units)})` : '—'}</b></div>
      <div><span>{tt('Governorates ordering', 'محافظات طلبت')}</span><b>{ordering}/18</b></div>
    </div>
    {unknown && (unknown.placed > 0 || unknown.revenue > 0) && <p className="gm-note">{tt(`Without a governorate (mostly wholesale): ${unknown.placed} orders · ${compact(unknown.revenue)} IQD revenue`, `بدون محافظة (غالباً الجملة): ${unknown.placed} طلب · إيراد ${compact(unknown.revenue)} د.ع`)}</p>}
  </div>;
}
