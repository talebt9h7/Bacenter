'use client';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { LoaderCircle } from 'lucide-react';
import { api } from './ui';

export function MessageActions({ id, status }: { id: number; status: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  async function update(next: string) { setBusy(true); try { await api(`/api/admin/messages/${id}`, { method: 'PUT', json: { status: next } }); router.refresh(); } finally { setBusy(false); } }
  return <button className="admin-btn admin-btn-ghost admin-btn-sm" disabled={busy} onClick={() => void update(status === 'open' ? 'resolved' : 'open')}>{busy ? <LoaderCircle size={13} className="spin" /> : status === 'open' ? 'Mark resolved' : 'Reopen'}</button>;
}
