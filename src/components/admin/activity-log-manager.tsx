'use client';
import { useEffect, useState } from 'react';
import { Activity, RefreshCw, Search } from 'lucide-react';
import { api, Field, useFlash } from './ui';
import { useLanguage } from '@/components/language-provider';
import { batchT } from '@/lib/i18n';

type Row = { id:number; action:string; entity:string; entityId:string|null; details:string|null; createdAt:string };
export function ActivityLogManager() {
  const { language } = useLanguage();
  const t = (label: string) => batchT(label, language);
  const [rows,setRows]=useState<Row[]>([]); const [entities,setEntities]=useState<string[]>([]); const [q,setQ]=useState(''); const [entity,setEntity]=useState(''); const [from,setFrom]=useState(''); const [to,setTo]=useState(''); const [loading,setLoading]=useState(true); const {flash,fail}=useFlash();
  async function load() { setLoading(true); try { const params=new URLSearchParams(); if(q)params.set('q',q); if(entity)params.set('entity',entity); if(from)params.set('from',from); if(to)params.set('to',to); params.set('limit','250'); const data=await api<{items:Row[];entities:string[]}>(`/api/admin/activity?${params}`); setRows(data.items); setEntities(data.entities); } catch(e){fail(e)} finally{setLoading(false)} }
  useEffect(()=>{ void load(); },[]);
  return <>{flash}<section className="admin-card"><div className="admin-card-heading"><div><h2><Activity size={17}/> Audit trail</h2><p className="admin-hint">{t('Newest actions first. Failed logging never blocks the underlying operation.')}</p></div><button className="admin-btn admin-btn-ghost admin-btn-sm" onClick={()=>void load()} disabled={loading}><RefreshCw size={14} className={loading?'spin':''}/> Refresh</button></div>
    <div className="admin-form-grid" style={{marginBottom:18}}><Field label={t('Search')}><div className="admin-input-icon"><Search size={15}/><input value={q} onChange={e=>setQ(e.target.value)} onKeyDown={e=>{if(e.key==='Enter')void load()}} placeholder={t('Action, entity, ID or details')}/></div></Field><Field label={t('Entity')}><select value={entity} onChange={e=>{setEntity(e.target.value); setTimeout(()=>void load(),0)}}><option value="">{t('All entities')}</option>{entities.map(x=><option key={x}>{x}</option>)}</select></Field><Field label={t('From')}><input type="date" value={from} onChange={e=>setFrom(e.target.value)}/></Field><Field label={t('To')}><input type="date" value={to} onChange={e=>setTo(e.target.value)}/></Field><div style={{alignSelf:'end'}}><button className="admin-btn admin-btn-primary admin-btn-sm" onClick={()=>void load()}>{t('Apply filters')}</button></div></div>
    <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>{t('Date')}</th><th>{t('Action')}</th><th>{t('Entity')}</th><th>{t('ID')}</th><th>{t('Details')}</th></tr></thead><tbody>{rows.map(r=><tr key={r.id}><td><small>{new Date(r.createdAt).toLocaleString()}</small></td><td><span className="admin-badge">{r.action}</span></td><td><strong>{r.entity}</strong></td><td>{r.entityId||'—'}</td><td><small>{r.details||'—'}</small></td></tr>)}{!rows.length&&!loading&&<tr><td colSpan={5}><p className="admin-empty">{t('No activity matches these filters.')}</p></td></tr>}</tbody></table></div></section></>;
}
