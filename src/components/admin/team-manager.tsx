'use client';

import { useState } from 'react';
import { KeyRound, LoaderCircle, Pencil, Plus, Save, ShieldCheck, Trash2, UserRound, X } from 'lucide-react';
import { api, Field, Modal, Switch, useFlash } from './ui';
import { useLanguage } from '@/components/language-provider';
import { batchT } from '@/lib/i18n';
import type { AdminSection, AdminPermissions } from '@/lib/admin-auth';

type UserRow = {
  id: number; username: string; name: string; role: string;
  permissions: AdminPermissions; active: boolean; lastLoginAt: string | null; createdAt: string;
};
type Props = {
  initial: UserRow[];
  roles: string[];
  sectionLabels: Record<AdminSection, string>;
  canManage: boolean;
};
const sections: AdminSection[] = ['overview','sales','catalog','storefront','finance','configuration','team'];
const roleNames: Record<string,string> = { manager:'Manager', sales:'Sales', inventory:'Inventory', content:'Content', accountant:'Accountant' };

function clonePermissions(input: AdminPermissions = {}) {
  const out: AdminPermissions = {};
  for (const section of sections) {
    const p = input[section];
    out[section] = { view: !!p?.view, manage: !!p?.manage };
  }
  return out;
}

function roleDefaults(role: string): AdminPermissions {
  const defaults: Record<string, AdminPermissions> = {
    manager: Object.fromEntries(sections.map(s => [s,{view:true,manage:true}])),
    sales: { overview:{view:true,manage:false}, sales:{view:true,manage:true}, catalog:{view:true,manage:false} },
    inventory: { overview:{view:true,manage:false}, catalog:{view:true,manage:true} },
    content: { overview:{view:true,manage:false}, storefront:{view:true,manage:true} },
    accountant: { overview:{view:true,manage:false}, sales:{view:true,manage:false}, finance:{view:true,manage:true}, configuration:{view:true,manage:false} },
  };
  return clonePermissions(defaults[role] || {});
}

export function TeamManager({ initial, roles, sectionLabels, canManage }: Props) {
  const { language } = useLanguage();
  const t = (label: string) => batchT(label, language);
  const [rows, setRows] = useState(initial);
  const [editing, setEditing] = useState<Partial<UserRow> & { password?: string; permissions: AdminPermissions } | null>(null);
  const [saving, setSaving] = useState(false);
  const { flash, success, fail } = useFlash();

  function openNew() {
    setEditing({ name:'', username:'', password:'', role:'sales', active:true, permissions:roleDefaults('sales') });
  }
  function openEdit(row: UserRow) {
    setEditing({ ...row, password:'', permissions:clonePermissions(row.permissions) });
  }
  function changeRole(role: string) {
    setEditing(e => e ? { ...e, role, permissions:roleDefaults(role) } : e);
  }
  function setPermission(section: AdminSection, level: 'view'|'manage', value: boolean) {
    setEditing(e => {
      if (!e) return e;
      const p = { ...clonePermissions(e.permissions) };
      const currentPermission = p[section] ?? { view:false, manage:false };
      p[section] = level === 'manage'
        ? { view:value, manage:value }
        : { view:value, manage:value ? currentPermission.manage : false };
      return { ...e, permissions:p };
    });
  }

  async function save() {
    if (!editing || !canManage) return;
    setSaving(true);
    try {
      const payload = {
        name: editing.name?.trim(), username: editing.username?.trim().toLowerCase(),
        role: editing.role, password: editing.password || undefined,
        active: editing.active !== false, permissions: editing.permissions,
      };
      const data = editing.id
        ? await api<{item:UserRow}>(`/api/admin/team/${editing.id}`, { method:'PUT', json:payload })
        : await api<{item:UserRow}>('/api/admin/team', { method:'POST', json:payload });
      setRows(current => editing.id ? current.map(r => r.id === editing.id ? data.item : r) : [...current, data.item].sort((a,b)=>a.name.localeCompare(b.name)));
      setEditing(null);
      success(t(editing.id ? 'User updated.' : 'User created.'));
    } catch (error) { fail(error); } finally { setSaving(false); }
  }

  async function remove(row: UserRow) {
    if (!canManage || !confirm(`${t('Delete')} ${row.name} (${row.username})?`)) return;
    try {
      await api(`/api/admin/team/${row.id}`, { method:'DELETE' });
      setRows(current => current.filter(r => r.id !== row.id));
      success(t('User deleted.'));
    } catch (error) { fail(error); }
  }

  return <>{flash}
    <section className="admin-card">
      <div className="admin-card-heading">
        <div><h2>{t('Admin users')}</h2><p className="admin-hint">{t('The store owner keeps the master password. These accounts are for staff members.')}</p></div>
        {canManage && <button className="admin-btn admin-btn-primary admin-btn-sm" onClick={openNew}><Plus size={14}/> {t('Add user')}</button>}
      </div>
      <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>{t('User')}</th><th>{t('Role')}</th><th>{t('Access')}</th><th>{t('Status')}</th><th>{t('Last login')}</th><th /></tr></thead>
        <tbody>{rows.map(row => <tr key={row.id}>
          <td><strong>{row.name}</strong><br/><small>@{row.username}</small></td>
          <td><span className="admin-badge">{roleNames[row.role] || row.role}</span></td>
          <td><small>{sections.filter(s => row.permissions?.[s]?.view).map(s => sectionLabels[s]).join(' · ') || t('No sections')}</small></td>
          <td><span className={`admin-badge ${row.active ? 'success' : 'muted'}`}>{row.active ? t('Active') : t('Disabled')}</span></td>
          <td><small>{row.lastLoginAt ? new Date(row.lastLoginAt).toLocaleString() : t('Never')}</small></td>
          <td className="num">{canManage && <><button className="admin-icon-btn" aria-label="Edit user" onClick={()=>openEdit(row)}><Pencil size={15}/></button><button className="admin-icon-btn danger" aria-label="Delete user" onClick={()=>void remove(row)}><Trash2 size={15}/></button></>}</td>
        </tr>)}{!rows.length && <tr><td colSpan={6}><p className="admin-empty">{t('No team users yet.')}</p></td></tr>}</tbody>
      </table></div>
    </section>

    <section className="admin-card">
      <div className="admin-card-heading"><div><h2>{t('Roles')}</h2><p className="admin-hint">{t('Roles are starting templates. You can customize permissions for every user.')}</p></div></div>
      <div className="admin-form-grid">
        {roles.map(role => <div key={role} className="admin-card" style={{margin:0,padding:'14px'}}><strong>{roleNames[role] || role}</strong><p className="admin-hint" style={{margin:'5px 0 0'}}>{role === 'manager' ? t('Full access.') : role === 'sales' ? t('Sales and customer operations.') : role === 'inventory' ? t('Products, stock and purchasing.') : role === 'content' ? t('Storefront content and media.') : t('Finance and reporting.')}</p></div>)}
      </div>
    </section>

    {editing && <Modal title={editing.id ? t('Edit team member') : t('Add team member')} onClose={()=>setEditing(null)} wide>
      <div className="admin-form-grid">
        <Field label={t('Full name')}><input value={editing.name || ''} onChange={e=>setEditing({...editing,name:e.target.value})} autoFocus /></Field>
        <Field label={t('Username')}><input value={editing.username || ''} onChange={e=>setEditing({...editing,username:e.target.value})} autoComplete="off" /></Field>
        <Field label={editing.id ? t('New password (optional)') : t('Password')} className="span-2"><div className="admin-input-icon"><KeyRound size={16}/><input type="password" value={editing.password || ''} onChange={e=>setEditing({...editing,password:e.target.value})} autoComplete="new-password" placeholder={editing.id ? 'Leave blank to keep current password' : 'At least 8 characters'} /></div></Field>
        <Field label={t('Role')}><select value={editing.role || 'manager'} onChange={e=>changeRole(e.target.value)}>{roles.map(role=><option key={role} value={role}>{roleNames[role] || role}</option>)}</select></Field>
        <div style={{alignSelf:'end'}}><Switch checked={editing.active !== false} onChange={active=>setEditing({...editing,active})} label={editing.active !== false ? t('Active') : t('Disabled')} /></div>
      </div>

      <div style={{marginTop:22}}>
        <h3 style={{margin:'0 0 6px'}}>{t('Section permissions')}</h3>
        <p className="admin-hint">{t('View lets the user open a section. Manage also allows changes. Manage automatically includes View.')}</p>
        <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>{t('Section')}</th><th>{t('View')}</th><th>{t('Manage')}</th></tr></thead><tbody>
          {sections.map(section => { const p=editing.permissions?.[section] || {view:false,manage:false}; return <tr key={section}><td><strong>{sectionLabels[section]}</strong></td><td><input type="checkbox" checked={p.view} onChange={e=>setPermission(section,'view',e.target.checked)} /></td><td><input type="checkbox" checked={p.manage} onChange={e=>setPermission(section,'manage',e.target.checked)} /></td></tr>})}
        </tbody></table></div>
      </div>
      <div className="admin-modal-actions"><button className="admin-btn admin-btn-ghost" onClick={()=>setEditing(null)}>{t('Cancel')}</button><button className="admin-btn admin-btn-primary" disabled={saving || !canManage} onClick={()=>void save()}>{saving?<LoaderCircle size={15} className="spin"/>:<Save size={15}/>} {t('Save user')}</button></div>
    </Modal>}
  </>;
}
