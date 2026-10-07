export function StatusBadge({ status }: { status: string }) {
  const tone: Record<string, string> = { pending: 'warning', confirmed: 'info', processing: 'info', shipped: 'info', delivered: 'success', cancelled: 'danger', returned: 'danger', demo_confirmed: 'muted', paid: 'success', unpaid: 'warning', refunded: 'muted', open: 'warning', resolved: 'success' };
  return <span className={`admin-badge ${tone[status] ?? 'muted'}`}>{status.replace('_', ' ')}</span>;
}
