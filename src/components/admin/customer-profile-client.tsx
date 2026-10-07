'use client';
import { useMemo, useState } from 'react';
import { Check, ExternalLink, MessageCircle, Plus, Save, X } from 'lucide-react';
import { iqd } from '@/lib/format';

type Customer = { id:number; name:string; phone:string; email:string|null; note:string|null; tags:string[]; marketingOptIn:boolean; preferredChannel:string; lastContactAt:string|Date|null };

type Props = { customer: Customer; phoneUrl: string; messages: { label:string; text:string }[] };

export function CustomerProfileClient({ customer: initial, phoneUrl, messages }: Props) {
  const [customer, setCustomer] = useState(initial);
  const [name, setName] = useState(initial.name);
  const [email, setEmail] = useState(initial.email ?? '');
  const [note, setNote] = useState(initial.note ?? '');
  const [tags, setTags] = useState(initial.tags ?? []);
  const [tagInput, setTagInput] = useState('');
  const [optIn, setOptIn] = useState(initial.marketingOptIn);
  const [channel, setChannel] = useState(initial.preferredChannel || 'whatsapp');
  const [message, setMessage] = useState(messages[0]?.text ?? '');
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);

  const whatsapp = useMemo(() => `https://wa.me/964${customer.phone.replace(/^0/, '')}?text=${encodeURIComponent(message)}`, [customer.phone, message]);
  async function save() {
    setBusy(true); setSaved(false);
    try {
      const res = await fetch(`/api/admin/customers/${customer.id}`, { method:'PATCH', headers:{'Content-Type':'application/json'}, body:JSON.stringify({name,email,note,tags,marketingOptIn:optIn,preferredChannel:channel}) });
      const data = await res.json(); if (!res.ok) throw new Error(data.error || 'Could not save');
      setCustomer(data.item); setSaved(true); setTimeout(() => setSaved(false), 1800);
    } finally { setBusy(false); }
  }
  function addTag() { const value = tagInput.trim(); if (!value || tags.includes(value) || tags.length >= 20) return; setTags([...tags,value]); setTagInput(''); }
  async function markContacted() { await fetch(`/api/admin/customers/${customer.id}`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({action:'contacted'}) }); setCustomer({...customer,lastContactAt:new Date()}); }
  return <div className="admin-customer-tools">
    <section className="admin-card">
      <div className="admin-card-heading"><h2>Customer profile</h2><span className="admin-count">CRM</span></div>
      <div className="admin-form-grid">
        <label className="admin-field"><span>Name</span><input value={name} onChange={e=>setName(e.target.value)} /></label>
        <label className="admin-field"><span>Email</span><input value={email} onChange={e=>setEmail(e.target.value)} /></label>
      </div>
      <label className="admin-field"><span>Internal note</span><textarea value={note} onChange={e=>setNote(e.target.value)} rows={4} placeholder="Preferences, sizing, gift occasions, follow-up notes…" /></label>
      <div className="admin-field"><span>Tags</span><div className="admin-tag-list">{tags.map(tag=><button key={tag} type="button" className="admin-tag" onClick={()=>setTags(tags.filter(t=>t!==tag))}>{tag}<X size={12}/></button>)}<input value={tagInput} onChange={e=>setTagInput(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'){e.preventDefault();addTag();}}} placeholder="Add tag…" /><button type="button" className="admin-btn admin-btn-ghost admin-btn-sm" onClick={addTag}><Plus size={14}/>Add</button></div></div>
      <div className="admin-form-grid">
        <label className="admin-field"><span>Preferred contact</span><select value={channel} onChange={e=>setChannel(e.target.value)}><option value="whatsapp">WhatsApp</option><option value="phone">Phone</option><option value="email">Email</option></select></label>
        <label className="admin-checkbox"><input type="checkbox" checked={optIn} onChange={e=>setOptIn(e.target.checked)} /><span>Marketing messages allowed</span></label>
      </div>
      <div className="admin-actions"><button className="admin-btn admin-btn-primary" disabled={busy} onClick={save}><Save size={15}/>{busy?'Saving…':'Save customer'} </button>{saved&&<span className="admin-success"><Check size={14}/>Saved</span>}</div>
    </section>
    <section className="admin-card">
      <div className="admin-card-heading"><h2><MessageCircle size={17}/> WhatsApp follow-up</h2>{customer.lastContactAt&&<span className="admin-count">Last contact: {new Date(customer.lastContactAt).toLocaleDateString('en-GB')}</span>}</div>
      <div className="admin-field"><span>Message template</span><select value={message} onChange={e=>setMessage(e.target.value)}>{messages.map(m=><option key={m.label} value={m.text}>{m.label}</option>)}</select></div>
      <textarea className="admin-field-input" rows={5} value={message} onChange={e=>setMessage(e.target.value)} />
      <div className="admin-actions"><a className="admin-btn admin-btn-primary" href={whatsapp} target="_blank" rel="noreferrer" onClick={markContacted}><MessageCircle size={15}/>Open WhatsApp</a><a className="admin-btn admin-btn-ghost" href={phoneUrl}><ExternalLink size={14}/>Call customer</a></div>
    </section>
  </div>;
}
