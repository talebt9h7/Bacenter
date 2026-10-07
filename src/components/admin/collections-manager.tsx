'use client';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Eye, EyeOff, LoaderCircle, Pencil, Plus, Save, Trash2 } from 'lucide-react';
import { api, Field, ImageField, Modal, Switch, useFlash } from './ui';
import { useLanguage } from '@/components/language-provider';
import { catalogT } from '@/lib/i18n';

type Product = { id: string; name: string; category: string; price: number };
type Collection = { id: string; slug: string; title: string; titleAr: string; description: string; descriptionAr: string; image: string; href: string; active: boolean; sortOrder: number; productIds?: string[] };

export function CollectionsManager({ initial, products }: { initial: Collection[]; products: Product[] }) {
  const { language } = useLanguage();
  const tr = (label: keyof typeof import('@/lib/i18n').catalogTranslations) => catalogT(label, language);
  const router = useRouter();
  const [rows, setRows] = useState(initial);
  const [editing, setEditing] = useState<Collection | null>(null);
  const [saving, setSaving] = useState(false);
  const { flash, success, fail } = useFlash();
  function newCollection() { setEditing({ id: `collection-${Date.now()}`, slug: '', title: '', titleAr: '', description: '', descriptionAr: '', image: '', href: '', active: true, sortOrder: rows.length, productIds: [] }); }
  async function save() {
    if (!editing) return;
    const slug = editing.slug.trim().toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '');
    if (!slug || !editing.title.trim()) { fail(new Error(tr('Collection title and slug are required.'))); return; }
    const next = { ...editing, slug, href: editing.href.trim() || `/collection/${slug}`, productIds: editing.productIds ?? [] };
    const duplicate = rows.some(row => row.id !== next.id && row.slug === next.slug);
    if (duplicate) { fail(new Error(tr('That collection slug already exists.'))); return; }
    setSaving(true);
    try {
      const updated = rows.some(row => row.id === next.id) ? rows.map(row => row.id === next.id ? next : row) : [...rows, next];
      await api('/api/admin/settings', { method: 'PUT', json: { homepage: { collections: updated } } });
      setRows(updated); setEditing(null); success(tr('Collections saved.'));
    } catch (error) { fail(error); } finally { setSaving(false); }
  }
  async function remove(row: Collection) {
    if (!confirm(`${tr('Delete')} ${row.title}?`)) return;
    const updated = rows.filter(item => item.id !== row.id);
    try { await api('/api/admin/settings', { method: 'PUT', json: { homepage: { collections: updated } } }); setRows(updated); success(tr('Collection deleted.')); } catch (error) { fail(error); }
  }
  async function toggle(row: Collection) {
    const updated = rows.map(item => item.id === row.id ? { ...item, active: !item.active } : item);
    try { await api('/api/admin/settings', { method: 'PUT', json: { homepage: { collections: updated } } }); setRows(updated); } catch (error) { fail(error); }
  }
  function toggleProduct(id: string) { if (!editing) return; const ids = new Set(editing.productIds ?? []); ids.has(id) ? ids.delete(id) : ids.add(id); setEditing({ ...editing, productIds: [...ids] }); }
  return <>
    {flash}
    <section className="admin-card">
      <div className="admin-card-heading"><div><h2>{tr('Collections')}</h2><p className="admin-hint" style={{margin:'4px 0 0'}}>{tr('Create and manage storefront collections, their landing pages and the products inside each collection.')}</p></div><button className="admin-btn admin-btn-primary admin-btn-sm" onClick={newCollection}><Plus size={14}/> {tr('Add collection')}</button></div>
      <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>{tr('Collection')}</th><th>{tr('Products')}</th><th>{tr('Link')}</th><th>{tr('Status')}</th><th>{tr('Actions')}</th></tr></thead><tbody>
        {rows.slice().sort((a,b)=>a.sortOrder-b.sortOrder).map(row => <tr key={row.id}><td><div style={{display:'flex',alignItems:'center',gap:12}}>{row.image ? <img src={row.image} alt="" style={{width:76,height:50,objectFit:'cover',borderRadius:8}}/> : <div style={{width:76,height:50,borderRadius:8,background:'#f1f1ef'}}/>}<div><strong>{language === 'ar' ? (row.titleAr || row.title) : row.title}</strong><small>{row.slug}</small></div></div></td><td>{row.productIds?.length ? `${row.productIds.length} ${tr('selected')}` : tr('Automatic / tag based')}</td><td><small>{row.href || `/collection/${row.slug}`}</small></td><td>{row.active ? tr('Active') : tr('Hidden')}</td><td><div className="admin-banner-actions"><button className="admin-icon-btn" onClick={()=>void toggle(row)}>{row.active ? <Eye size={15}/> : <EyeOff size={15}/>}</button><button className="admin-icon-btn" onClick={()=>setEditing({...row,productIds:[...(row.productIds??[])]})}><Pencil size={15}/></button><button className="admin-icon-btn danger" onClick={()=>void remove(row)}><Trash2 size={15}/></button></div></td></tr>)}
      </tbody></table></div>
    </section>
    {editing && <Modal title={rows.some(row=>row.id===editing.id) ? tr('Edit collection') : tr('New collection')} onClose={()=>setEditing(null)} wide>
      <div className="admin-form-grid">
        <Field label={tr('Title')}><input value={editing.title} onChange={e=>setEditing({...editing,title:e.target.value})} placeholder="Transit"/></Field><Field label="العنوان — العربية"><input dir="rtl" value={editing.titleAr} onChange={e=>setEditing({...editing,titleAr:e.target.value})} placeholder="ترانزيت"/></Field>
        <Field label={tr('Slug')}><input value={editing.slug} onChange={e=>setEditing({...editing,slug:e.target.value})} placeholder="transit"/></Field>
        <Field label={tr('Description')}><textarea rows={3} value={editing.description} onChange={e=>setEditing({...editing,description:e.target.value})}/></Field><Field label="الوصف — العربية"><textarea dir="rtl" rows={3} value={editing.descriptionAr} onChange={e=>setEditing({...editing,descriptionAr:e.target.value})}/></Field>
        <ImageField label={tr('Collection image')} value={editing.image} onChange={image=>setEditing({...editing,image})}/>
        <Field label={tr('Link')}><input value={editing.href} onChange={e=>setEditing({...editing,href:e.target.value})} placeholder="/collection/transit"/></Field>
        <Field label={tr('Order')}><input type="number" value={editing.sortOrder} onChange={e=>setEditing({...editing,sortOrder:Number(e.target.value)})}/></Field>
        <div className="span-2"><Switch checked={editing.active} onChange={active=>setEditing({...editing,active})} label={editing.active?tr('Visible'):tr('Hidden')}/></div>
        <div className="span-2"><div className="admin-card-heading" style={{marginBottom:10}}><div><h3>{tr('Products in collection')}</h3><p className="admin-hint">{tr('Select products explicitly. If none are selected, the storefront falls back to the existing tag/category logic.')}</p></div><strong>{editing.productIds?.length ?? 0}</strong></div><div style={{display:'grid',gridTemplateColumns:'repeat(2,minmax(0,1fr))',gap:8,maxHeight:340,overflow:'auto',padding:4,border:'1px solid #e5e5e2',borderRadius:10}}>{products.map(product=>{const checked=editing.productIds?.includes(product.id) ?? false; return <label key={product.id} style={{display:'flex',alignItems:'center',gap:10,padding:'10px 12px',borderRadius:8,background:checked?'#f4f0e8':'transparent',cursor:'pointer'}}><input type="checkbox" checked={checked} onChange={()=>toggleProduct(product.id)}/><span><strong>{product.name}</strong><small style={{display:'block'}}>{product.category}</small></span></label>})}</div></div>
      </div>
      <div className="admin-modal-actions"><button className="admin-btn admin-btn-ghost" onClick={()=>setEditing(null)}>{tr('Cancel')}</button><button className="admin-btn admin-btn-primary" onClick={()=>void save()} disabled={saving}>{saving?<LoaderCircle size={15} className="spin"/>:<Save size={15}/>} {tr('Save collection')}</button></div>
    </Modal>}
  </>;
}
