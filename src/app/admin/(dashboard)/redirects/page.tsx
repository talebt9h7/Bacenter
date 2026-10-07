import { redirect } from 'next/navigation';
import { requireAdminSection } from '@/lib/admin-auth';
import { RedirectsManager } from '@/components/admin/redirects-manager';
export const dynamic='force-dynamic';
export const metadata={title:'URL Redirects'};
export default async function RedirectsPage(){const actor=await requireAdminSection('configuration','view'); if(!actor)redirect('/admin'); return <main className="admin-page"><div className="admin-page-heading"><div><span className="admin-eyebrow">Configuration</span><h1>URL Redirects</h1><p>Keep old links working when products, collections or pages move.</p></div></div><RedirectsManager/></main>}
