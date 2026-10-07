import type { ReactNode } from 'react';
import { redirect } from 'next/navigation';
import { getAdminActor } from '@/lib/admin-auth';
import { AdminNav } from '@/components/admin/admin-nav';

export const metadata = { title: { default: 'Admin', template: '%s | Bellroy Admin' } };
export default async function AdminLayout({ children }: { children: ReactNode }) {
  const actor = await getAdminActor();
  if (!actor) redirect('/admin/login');
  return <div className="admin-shell"><AdminNav actor={actor} /><div className="admin-main">{children}</div></div>;
}
