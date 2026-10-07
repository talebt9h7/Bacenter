'use client';
import { useState } from 'react';
import { Eye, EyeOff, MapPin, Pencil, Plus, Trash2 } from 'lucide-react';
import { Modal } from '@/components/admin/ui';

type Row = {
  id: number; name: string; nameAr: string; address: string; addressAr: string;
  description: string; descriptionAr: string; mapUrl: string; phone: string | null;
  hours: string; hoursAr: string; image: string | null; active: boolean; sortOrder: number;
};
const api = async (url: string, options: RequestInit = {}) => {
  const r = await fetch(url, { ...options, headers: { 'Content-Type': 'application/json', ...(options.headers || {}) } });
  const d = await r.json().catch(() => ({})); if (!r.ok) throw new Error(d.error || 'Request failed'); return d;
};
const empty = (sortOrder: number): Partial<Row> => ({ name: '', nameAr: '', address: '', addressAr: '', description: '', descriptionAr: '', mapUrl: '', phone: '', hours: '', hoursAr: '', image: '', active: true, sortOrder });

export function StoreLocationManager({ initial }: { initial: Row[] }) {
  const [rows, setRows] = useState(initial); const [editing, setEditing] = useState<Partial<Row> | null>(null); const [busy, setBusy] = useState(false); const [error, setError] = useState('');
  const save = async () => {
    if (!editing?.name?.trim()) return setError('Store name is required.');
    setBusy(true); setError('');
    try { const data = await api('/api/admin/store-locations', { method: editing.id ? 'PUT' : 'POST', body: JSON.stringify(editing) }); setRows(prev => editing.id ? prev.map(x => x.id === data.store.id ? data.store : x) : [...prev, data.store]); setEditing(null); }
    catch (e) { setError(e instanceof Error ? e.message : 'Could not save store.'); } finally { setBusy(false); }
  };
  const remove = async (row: Row) => { if (!confirm(`Delete ${row.name}?`)) return; try { await api('/api/admin/store-locations', { method: 'DELETE', body: JSON.stringify({ id: row.id }) }); setRows(prev => prev.filter(x => x.id !== row.id)); } catch (e) { alert(e instanceof Error ? e.message : 'Could not delete store.'); } };
  const toggle = async (row: Row) => { try { const data = await api('/api/admin/store-locations', { method: 'PUT', body: JSON.stringify({ ...row, active: !row.active }) }); setRows(prev => prev.map(x => x.id === row.id ? data.store : x)); } catch (e) { alert(e instanceof Error ? e.message : 'Could not update store.'); } };
  return <section className="admin-card">
    <div className="admin-card-heading"><div><h2>Points of sale</h2><p className="admin-hint">Add, edit, hide or reorder the locations shown on the public Stores & stockists page.</p></div><button className="admin-btn admin-btn-primary" onClick={() => setEditing(empty(rows.length * 10))}><Plus size={15} /> Add point of sale</button></div>
    <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Store</th><th>Arabic</th><th>Address</th><th>Status</th><th>Order</th><th>Actions</th></tr></thead><tbody>{rows.map(row => <tr key={row.id}><td><strong>{row.name}</strong></td><td>{row.nameAr || '—'}</td><td>{row.address || '—'}</td><td>{row.active ? 'Active' : 'Hidden'}</td><td>{row.sortOrder}</td><td><div className="admin-inline-actions"><button className="admin-btn admin-btn-ghost" onClick={() => setEditing(row)}><Pencil size={14} /> Edit</button><button className="admin-btn admin-btn-ghost" onClick={() => void toggle(row)}>{row.active ? <EyeOff size={14} /> : <Eye size={14} />}</button><button className="admin-btn admin-btn-ghost" onClick={() => void remove(row)}><Trash2 size={14} /></button></div></td></tr>)}{!rows.length && <tr><td colSpan={6}><div className="admin-empty"><MapPin size={22} /> No points of sale yet.</div></td></tr>}</tbody></table></div>
    {editing && <Modal title={editing.id ? 'Edit point of sale' : 'Add point of sale'} onClose={() => setEditing(null)}><div className="admin-form-grid">
      <label className="admin-field"><span>Store name</span><input value={editing.name ?? ''} onChange={e => setEditing({ ...editing, name: e.target.value })} required /></label>
      <label className="admin-field"><span>Arabic name</span><input value={editing.nameAr ?? ''} onChange={e => setEditing({ ...editing, nameAr: e.target.value })} /></label>
      <label className="admin-field"><span>Address</span><input value={editing.address ?? ''} onChange={e => setEditing({ ...editing, address: e.target.value })} /></label>
      <label className="admin-field"><span>العنوان</span><input dir="rtl" value={editing.addressAr ?? ''} onChange={e => setEditing({ ...editing, addressAr: e.target.value })} /></label>
      <label className="admin-field"><span>Description</span><textarea value={editing.description ?? ''} onChange={e => setEditing({ ...editing, description: e.target.value })} /></label>
      <label className="admin-field"><span>الوصف</span><textarea dir="rtl" value={editing.descriptionAr ?? ''} onChange={e => setEditing({ ...editing, descriptionAr: e.target.value })} /></label>
      <label className="admin-field"><span>Google Maps URL</span><input value={editing.mapUrl ?? ''} onChange={e => setEditing({ ...editing, mapUrl: e.target.value })} placeholder="https://maps.google.com/..." /></label>
      <label className="admin-field"><span>Phone</span><input value={editing.phone ?? ''} onChange={e => setEditing({ ...editing, phone: e.target.value })} /></label>
      <label className="admin-field"><span>Opening hours</span><input value={editing.hours ?? ''} onChange={e => setEditing({ ...editing, hours: e.target.value })} /></label>
      <label className="admin-field"><span>ساعات العمل</span><input dir="rtl" value={editing.hoursAr ?? ''} onChange={e => setEditing({ ...editing, hoursAr: e.target.value })} /></label>
      <label className="admin-field"><span>Image URL</span><input value={editing.image ?? ''} onChange={e => setEditing({ ...editing, image: e.target.value })} /></label>
      <label className="admin-field"><span>Sort order</span><input type="number" value={editing.sortOrder ?? 0} onChange={e => setEditing({ ...editing, sortOrder: Number(e.target.value) })} /></label>
      <label className="admin-field admin-checkbox"><span>Visible on storefront</span><input type="checkbox" checked={editing.active !== false} onChange={e => setEditing({ ...editing, active: e.target.checked })} /></label>
    </div>{error && <p className="admin-error">{error}</p>}<div className="admin-modal-actions"><button className="admin-btn admin-btn-ghost" onClick={() => setEditing(null)}>Cancel</button><button className="admin-btn admin-btn-primary" disabled={busy} onClick={() => void save()}>{busy ? 'Saving…' : 'Save point of sale'}</button></div></Modal>}
  </section>;
}
