'use client';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Check, ImagePlus, LoaderCircle, X } from 'lucide-react';

export async function api<T = unknown>(url: string, init?: RequestInit & { json?: unknown }): Promise<T> {
  const response = await fetch(url, { ...init, headers: init?.json !== undefined ? { 'Content-Type': 'application/json', ...(init?.headers ?? {}) } : init?.headers, body: init?.json !== undefined ? JSON.stringify(init.json) : init?.body });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || 'Something went wrong.');
  return data as T;
}
export function useFlash() {
  const [flash, setFlash] = useState<{ text: string; error: boolean } | null>(null);
  useEffect(() => { if (!flash || flash.error) return; const timer = setTimeout(() => setFlash(null), 3500); return () => clearTimeout(timer); }, [flash]);
  const node = flash ? <div className={`admin-alert ${flash.error ? 'error' : 'success'}`} role="status">{flash.error ? <X size={16} /> : <Check size={16} />}{flash.text}<button onClick={() => setFlash(null)} aria-label="Dismiss"><X size={14} /></button></div> : null;
  return { flash: node, success: (text: string) => setFlash({ text, error: false }), fail: (error: unknown) => setFlash({ text: error instanceof Error ? error.message : String(error), error: true }) };
}
export function Field({ label, hint, children, className = '' }: { label: ReactNode; hint?: ReactNode; children: ReactNode; className?: string }) { return <label className={`admin-field ${className}`}><span>{label}</span>{children}{hint && <small>{hint}</small>}</label>; }
export function Switch({ checked, onChange, label }: { checked: boolean; onChange: (value: boolean) => void; label: ReactNode }) { return <label className="admin-switch"><input type="checkbox" checked={checked} onChange={event => onChange(event.target.checked)} /><span /> {label}</label>; }
export function ImageField({ value, onChange, label, hint }: { value: string; onChange: (url: string) => void; label: ReactNode; hint?: ReactNode }) {
  const input = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  async function upload(files: FileList | null) {
    if (!files?.length) return; setUploading(true); setError('');
    try { const form = new FormData(); form.append('files', files[0]); const data = await api<{ urls: string[] }>('/api/admin/media', { method: 'POST', body: form }); onChange(data.urls[0]); }
    catch (err) { setError(err instanceof Error ? err.message : 'Upload failed.'); }
    finally { setUploading(false); if (input.current) input.current.value = ''; }
  }
  return <div className="admin-field"><span>{label}</span><div className="admin-image-field">{value ? <img src={value} alt="" /> : <div className="admin-image-empty"><ImagePlus size={20} /></div>}<div className="admin-image-field-controls"><input value={value} onChange={event => onChange(event.target.value)} placeholder="/images/… or https://…" aria-label={`${typeof label === 'string' ? label : 'Image'} URL`} /><div><input ref={input} type="file" accept="image/*" hidden onChange={event => void upload(event.target.files)} /><button type="button" className="admin-btn admin-btn-ghost admin-btn-sm" onClick={() => input.current?.click()} disabled={uploading}>{uploading ? <LoaderCircle size={14} className="spin" /> : <ImagePlus size={14} />} Upload</button>{value && <button type="button" className="admin-btn admin-btn-ghost admin-btn-sm" onClick={() => onChange('')}>Clear</button>}</div></div></div>{error ? <small className="admin-error">{error}</small> : hint && <small>{hint}</small>}</div>;
}
export function Modal({ title, onClose, children, wide = false }: { title: string; onClose: () => void; children: ReactNode; wide?: boolean }) {
  useEffect(() => { const handler = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose(); }; document.addEventListener('keydown', handler); document.body.style.overflow = 'hidden'; return () => { document.removeEventListener('keydown', handler); document.body.style.overflow = ''; }; }, [onClose]);
  return <div className="admin-modal-overlay" onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}><div className={`admin-modal ${wide ? 'wide' : ''}`} role="dialog" aria-modal="true" aria-label={title}><div className="admin-modal-heading"><h2>{title}</h2><button className="admin-icon-btn" onClick={onClose} aria-label="Close"><X size={20} /></button></div><div className="admin-modal-body">{children}</div></div></div>;
}
export { iqd, money, when } from '@/lib/format';
export { StatusBadge } from './status-badge';
