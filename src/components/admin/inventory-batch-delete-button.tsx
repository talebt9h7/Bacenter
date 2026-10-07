'use client';
import { useState } from 'react';
import { LoaderCircle, Trash2 } from 'lucide-react';
import { api, useFlash } from './ui';

export function InventoryBatchDeleteButton({ batchId, disabled, label, confirmLabel, successLabel, blockedLabel }: { batchId: number; disabled: boolean; label: string; confirmLabel: string; successLabel: string; blockedLabel: string }) {
  const [busy, setBusy] = useState(false);
  const { flash, success, fail } = useFlash();
  async function remove() {
    if (disabled) { fail(blockedLabel); return; }
    if (!window.confirm(confirmLabel)) return;
    setBusy(true);
    try { await api('/api/admin/inventory', { method: 'DELETE', json: { batchId } }); success(successLabel); window.location.reload(); }
    catch (error) { fail(error); }
    finally { setBusy(false); }
  }
  return <>{flash}<button type="button" className="admin-btn admin-btn-ghost admin-btn-sm" disabled={busy} onClick={() => void remove()} title={disabled ? blockedLabel : label} aria-label={label}>{busy ? <LoaderCircle size={14} className="spin" /> : <Trash2 size={14} />} {label}</button></>;
}
