'use client';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Eye, EyeOff, ImagePlus, LoaderCircle, Pencil, Plus, Save, Trash2 } from 'lucide-react';
import { api, Field, ImageField, Modal, Switch, useFlash } from './ui';
import { useLanguage } from '@/components/language-provider';
import { storefrontT } from '@/lib/i18n';

type Category = { id: string; name: string };
type Banner = { id: number; categoryId: string | null; title: string; subtitle: string | null; ctaLabel: string | null; href: string; image: string; mobileImage: string | null; badge: string | null; active: boolean; sortOrder: number };

export function SectionManager({ categories, banners }: { categories: Category[]; banners: Banner[] }) {
  const { language } = useLanguage();
  const t = (label: string) => storefrontT(label, language);
  const router = useRouter();
  const [rows, setRows] = useState(banners);
  const [editing, setEditing] = useState<Partial<Banner> & { categoryId: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const { flash, success, fail } = useFlash();
  const getBanner = (id: string) => rows.find(row => row.categoryId === id);
  const categoryName = (id: string) => categories.find(c => c.id === id)?.name ?? id;

  async function save() {
    if (!editing) return;
    setSaving(true);
    try {
      const payload = { ...editing, kind: 'category', categoryId: editing.categoryId, startsAt: null, endsAt: null };
      const data = editing.id
        ? await api<{ item: Banner }>(`/api/admin/banners/${editing.id}`, { method: 'PUT', json: payload })
        : await api<{ item: Banner }>('/api/admin/banners', { method: 'POST', json: payload });
      setRows(current => editing.id ? current.map(row => row.id === editing.id ? data.item : row) : [...current, data.item]);
      setEditing(null); success(editing.id ? 'Category banner updated.' : 'Category banner created.');
    } catch (error) { fail(error); } finally { setSaving(false); }
  }
  async function toggle(row: Banner) {
    try {
      const data = await api<{ item: Banner }>(`/api/admin/banners/${row.id}`, { method: 'PUT', json: { ...row, kind: 'category', active: !row.active } });
      setRows(current => current.map(item => item.id === row.id ? data.item : item));
    } catch (error) { fail(error); }
  }
  async function remove(row: Banner) {
    if (!confirm(`Delete the banner for ${categoryName(row.categoryId ?? '')}?`)) return;
    try { await api(`/api/admin/banners/${row.id}`, { method: 'DELETE' }); setRows(current => current.filter(item => item.id !== row.id)); success('Category banner deleted.'); } catch (error) { fail(error); }
  }

  return <>
    {flash}
    <section className="admin-card">
      <div className="admin-card-heading"><div><h2>{t('Store sections & category banners')}</h2><p className="admin-hint" style={{ margin: '4px 0 0' }}>{t('Control the visual banner shown at the top of each product category page.')}</p></div></div>
      <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>{t('Section')}</th><th>{t('Banner')}</th><th>{t('Status')}</th><th>{t('Actions')}</th></tr></thead><tbody>
        {categories.filter(c => c.id !== 'all').map(category => {
          const banner = getBanner(category.id);
          return <tr key={category.id}>
            <td><strong>{category.name}</strong><small>{category.id}</small></td>
            <td>{banner ? <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}><img src={banner.image} alt="" style={{ width: 86, height: 52, objectFit: 'cover', borderRadius: 8 }} /><div><strong>{banner.title}</strong><small>{banner.href}</small></div></div> : <span className="admin-muted">{t('No banner yet')}</span>}</td>
            <td>{banner ? (banner.active ? t('Active') : t('Hidden')) : '—'}</td>
            <td><div className="admin-banner-actions"><button className="admin-btn admin-btn-ghost admin-btn-sm" onClick={() => setEditing(banner ? { ...banner, categoryId: category.id } : { categoryId: category.id, title: category.name, subtitle: '', ctaLabel: 'Shop now', href: `/products/category/${category.id}`, image: '', mobileImage: '', badge: '', active: true, sortOrder: 0 })}><Pencil size={14} /> {banner ? 'Edit' : 'Add banner'}</button>{banner && <><button className="admin-icon-btn" aria-label="Toggle visibility" onClick={() => void toggle(banner)}>{banner.active ? <Eye size={15} /> : <EyeOff size={15} />}</button><button className="admin-icon-btn danger" aria-label="Delete" onClick={() => void remove(banner)}><Trash2 size={15} /></button></>}</div></td>
          </tr>;
        })}
      </tbody></table></div>
    </section>
    {editing && <Modal title={`${editing.id ? t('Edit') : t('Add')} ${categoryName(editing.categoryId)} ${t('Banner')}`} onClose={() => setEditing(null)} wide>
      <div className="admin-form-grid">
        <Field label={t('Category')}><select value={editing.categoryId} onChange={e => setEditing({ ...editing, categoryId: e.target.value })}>{categories.filter(c => c.id !== 'all').map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></Field>
        <Field label={t('Title')}><input value={editing.title ?? ''} onChange={e => setEditing({ ...editing, title: e.target.value })} /></Field>
        <Field label={t('Subtitle / alt text')} className="span-2"><input value={editing.subtitle ?? ''} onChange={e => setEditing({ ...editing, subtitle: e.target.value })} /></Field>
        <Field label={t('Button label')}><input value={editing.ctaLabel ?? ''} onChange={e => setEditing({ ...editing, ctaLabel: e.target.value })} /></Field>
        <Field label={t('Link')}><input value={editing.href ?? ''} onChange={e => setEditing({ ...editing, href: e.target.value })} /></Field>
        <ImageField label={t('Desktop banner')} value={editing.image ?? ''} onChange={image => setEditing({ ...editing, image })} hint="Recommended wide category hero image." />
        <ImageField label={t('Mobile banner')} value={editing.mobileImage ?? ''} onChange={mobileImage => setEditing({ ...editing, mobileImage })} />
        <Field label={t('Badge')}><input value={editing.badge ?? ''} onChange={e => setEditing({ ...editing, badge: e.target.value })} placeholder={t('NEW / SALE')} /></Field>
        <Field label={t('Order')}><input type="number" value={editing.sortOrder ?? 0} onChange={e => setEditing({ ...editing, sortOrder: Number(e.target.value) })} /></Field>
        <div className="span-2"><Switch checked={editing.active !== false} onChange={active => setEditing({ ...editing, active })} label={editing.active !== false ? 'Active' : 'Hidden'} /></div>
      </div>
      <div className="admin-modal-actions"><button className="admin-btn admin-btn-ghost" onClick={() => setEditing(null)}>{t('Cancel')}</button><button className="admin-btn admin-btn-primary" onClick={save} disabled={saving}>{saving ? <LoaderCircle size={15} className="spin" /> : <Save size={15} />} Save banner</button></div>
    </Modal>}
  </>;
}
