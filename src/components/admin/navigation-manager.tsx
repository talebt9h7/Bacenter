'use client';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { ArrowDown, ArrowUp, GripVertical, LoaderCircle, Plus, Save, Trash2 } from 'lucide-react';
import type { NavigationGroup } from '@/lib/settings';
import { api, Field, useFlash } from './ui';
import { useLanguage } from '@/components/language-provider';
import { storefrontT } from '@/lib/i18n';

function blankGroup(): NavigationGroup { return { name: '', nameAr: '', href: '/', links: [{ label: '', labelAr: '', href: '/' }], image: '', caption: '', captionAr: '' }; }
export function NavigationManager({ initial }: { initial: NavigationGroup[] }) {
  const { language } = useLanguage();
  const t = (label: string) => storefrontT(label, language);
  const router = useRouter();
  const [rows, setRows] = useState(initial);
  const [saving, setSaving] = useState(false);
  const { flash, success, fail } = useFlash();
  function update(index: number, patch: Partial<NavigationGroup>) { setRows(current => current.map((row, i) => i === index ? { ...row, ...patch } : row)); }
  function updateLink(groupIndex: number, linkIndex: number, patch: Partial<NavigationGroup['links'][number]>) { setRows(current => current.map((row, i) => i === groupIndex ? { ...row, links: row.links.map((link, j) => j === linkIndex ? { ...link, ...patch } : link) } : row)); }
  function move(index: number, direction: -1 | 1) { const target = index + direction; if (target < 0 || target >= rows.length) return; const next = [...rows]; [next[index], next[target]] = [next[target], next[index]]; setRows(next); }
  function remove(index: number) { if (!confirm(language === 'ar' ? `إزالة «${rows[index].nameAr || rows[index].name || 'عنصر القائمة'}» من الرأس؟` : `Remove “${rows[index].name || 'this menu item'}” from the header?`)) return; setRows(current => current.filter((_, i) => i !== index)); }
  async function save() { setSaving(true); try { await api('/api/admin/settings', { method: 'PUT', json: { navigation: rows } }); success(t('Header navigation saved. The storefront now reflects the changes.')); } catch (error) { fail(error); } finally { setSaving(false); } }
  return <>{flash}<section className="admin-card"><div className="admin-card-heading"><div><h2>{t('Header navigation')}</h2><p className="admin-hint" style={{ margin: '4px 0 0' }}>{t('Control the menu shown in the storefront header. Changes apply to desktop and mobile navigation.')}</p></div><button className="admin-btn admin-btn-primary admin-btn-sm" onClick={() => setRows(current => [...current, blankGroup()])}><Plus size={14} /> {t('Add menu item')}</button></div>
    <div style={{ display: 'grid', gap: 16 }}>{rows.map((row, index) => <article key={`${index}-${row.name}`} className="admin-card" style={{ margin: 0, border: '1px solid var(--admin-border)' }}>
      <div className="admin-card-heading"><div style={{ display: 'flex', alignItems: 'center', gap: 10 }}><GripVertical size={17} /><strong>{row.name || `${t('Menu item')} ${index + 1}`}</strong></div><div style={{ display: 'flex', gap: 6 }}><button className="admin-icon-btn" disabled={index === 0} onClick={() => move(index, -1)} aria-label={t('Move up')}><ArrowUp size={15} /></button><button className="admin-icon-btn" disabled={index === rows.length - 1} onClick={() => move(index, 1)} aria-label={t('Move down')}><ArrowDown size={15} /></button><button className="admin-icon-btn danger" onClick={() => remove(index)} aria-label={t('Remove')}><Trash2 size={15} /></button></div></div>
      <div className="admin-form-grid"><Field label={language === 'ar' ? 'اسم القائمة — الإنجليزية' : 'Menu name — English'}><input value={row.name} onChange={e => update(index, { name: e.target.value })} placeholder="Wallets" /></Field><Field label={language === 'ar' ? 'اسم القائمة — العربية' : 'Menu name — Arabic'}><input dir="rtl" value={row.nameAr ?? ''} onChange={e => update(index, { nameAr: e.target.value })} placeholder="المحافظ" /></Field><Field label={t('Main link')}><input value={row.href} onChange={e => update(index, { href: e.target.value })} placeholder="/products/category/wallets" /></Field><Field label={t('Dropdown image')}><input value={row.image} onChange={e => update(index, { image: e.target.value })} placeholder="/images/wallets.jpg" /></Field><Field label={language === 'ar' ? 'وصف القائمة — الإنجليزية' : 'Dropdown caption — English'}><input value={row.caption} onChange={e => update(index, { caption: e.target.value })} placeholder="Less bulk. More possibility." /></Field><Field label={language === 'ar' ? 'وصف القائمة — العربية' : 'Dropdown caption — Arabic'}><input dir="rtl" value={row.captionAr ?? ''} onChange={e => update(index, { captionAr: e.target.value })} placeholder="أناقة أكثر، حجم أقل." /></Field>
        <div className="span-2"><h3 className="admin-subheading">{t('Dropdown links')}</h3>{row.links.map((link, linkIndex) => <div className="admin-section-row" key={linkIndex}><input value={link.label} placeholder={language === 'ar' ? 'اسم الرابط — الإنجليزية' : 'Link name — English'} onChange={e => updateLink(index, linkIndex, { label: e.target.value })} /><input dir="rtl" value={link.labelAr ?? ''} placeholder="اسم الرابط — العربية" onChange={e => updateLink(index, linkIndex, { labelAr: e.target.value })} /><input value={link.href} placeholder="/products/..." onChange={e => updateLink(index, linkIndex, { href: e.target.value })} /><button className="admin-icon-btn danger" aria-label={t('Remove dropdown link')} onClick={() => update(index, { links: row.links.filter((_, i) => i !== linkIndex) })}><Trash2 size={15} /></button></div>)}<button className="admin-btn admin-btn-ghost admin-btn-sm" onClick={() => update(index, { links: [...row.links, { label: '', labelAr: '', href: '/' }] })}><Plus size={14} /> {t('Add dropdown link')}</button></div>
      </div>
    </article>)}</div>
    <div className="admin-modal-actions" style={{ marginTop: 18 }}><button className="admin-btn admin-btn-primary" onClick={save} disabled={saving}>{saving ? <LoaderCircle size={15} className="spin" /> : <Save size={15} />} {t('Save navigation')}</button></div>
  </section></>;
}
