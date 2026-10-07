'use client';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import { Pencil, Search } from 'lucide-react';
import { useLanguage } from '@/components/language-provider';
import { productT } from '@/lib/i18n';

type Row = { id: string; name: string; image: string; category: string; price: number; published: boolean; stock: number; colors: { id: number; name: string; hex: string; stock: number; photos: number }[] };
const iqd = (value: number) => `${Math.round(value).toLocaleString('en-US')} IQD`;
export function ProductTable({ rows }: { rows: Row[] }) {
  const { language } = useLanguage();
  const tr = (label: keyof typeof import('@/lib/i18n').productTranslations) => productT(label, language);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<'all' | 'low' | 'soldout' | 'draft'>('all');
  const visible = useMemo(() => rows.filter(row => {
    const matches = !query || `${row.name} ${row.category} ${row.id} ${row.colors.map(color => color.name).join(' ')}`.toLowerCase().includes(query.toLowerCase());
    if (!matches) return false;
    if (filter === 'low') return row.colors.some(color => color.stock > 0 && color.stock <= 5);
    if (filter === 'soldout') return row.colors.some(color => color.stock === 0);
    if (filter === 'draft') return !row.published;
    return true;
  }), [rows, query, filter]);
  return <section className="admin-card"><div className="admin-toolbar"><label className="admin-search"><Search size={16} /><input placeholder={tr('Search products or colors…')} value={query} onChange={event => setQuery(event.target.value)} aria-label={tr('Search products')} /></label><div className="admin-segmented" role="tablist">{([['all', 'All'], ['low', 'Low stock'], ['soldout', 'Sold out'], ['draft', 'Drafts']] as const).map(([key, label]) => <button key={key} role="tab" aria-selected={filter === key} className={filter === key ? 'active' : ''} onClick={() => setFilter(key)}>{tr(label as keyof typeof import('@/lib/i18n').productTranslations)}</button>)}</div><span className="admin-count">{visible.length} / {rows.length}</span></div>
    <div className="admin-table-wrap"><table className="admin-table admin-products-table"><thead><tr><th>{tr('Product')}</th><th>{tr('Category')}</th><th className="num">{tr('Price')}</th><th>{tr('Colors & stock')}</th><th className="num">{tr('Total stock')}</th><th>{tr('Status')}</th><th /></tr></thead><tbody>{visible.map(row => <tr key={row.id}><td><Link href={`/admin/products/${row.id}`} className="admin-product-cell"><img src={row.image} alt="" /><div><strong>{row.name}</strong><small>/{row.id}</small></div></Link></td><td>{row.category}</td><td className="num">{iqd(row.price)}</td><td><div className="admin-color-chips">{row.colors.map(color => <Link key={color.id} href={`/admin/products/${row.id}?color=${color.id}`} className={`admin-chip ${color.stock === 0 ? 'danger' : color.stock <= 5 ? 'warning' : ''}`} title={`${color.name}: ${color.stock} in stock · ${color.photos} photos`}><i style={{ background: color.hex }} />{color.name}<b>{color.stock}</b></Link>)}</div></td><td className="num"><strong>{row.stock}</strong></td><td>{row.published ? <span className="admin-badge success">{tr('Live')}</span> : <span className="admin-badge muted">{tr('Draft')}</span>}</td><td className="num"><Link href={`/admin/products/${row.id}`} className="admin-btn admin-btn-ghost admin-btn-sm"><Pencil size={14} /> {tr('Edit')}</Link></td></tr>)}{!visible.length && <tr><td colSpan={7}><p className="admin-empty">{tr('No products match that filter.')}</p></td></tr>}</tbody></table></div></section>;
}
