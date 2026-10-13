import { AdminHeading } from '@/components/admin/admin-heading';
import { redirect } from 'next/navigation';
import { requireAdminSection } from '@/lib/admin-auth';
import { RedirectsManager } from '@/components/admin/redirects-manager';
export const dynamic='force-dynamic';
export const metadata={title:'URL Redirects'};
export default async function RedirectsPage(){const actor=await requireAdminSection('configuration','view'); if(!actor)redirect('/admin'); return <main className="admin-page"><AdminHeading eyebrow={{ en: 'Configuration', ar: 'الإعدادات' }} title={{ en: 'URL Redirects', ar: 'تحويل الروابط' }} description={{ en: 'Keep old links working when products, collections or pages move.', ar: 'خلّي الروابط القديمة تشتغل لما تنقل منتج أو مجموعة أو صفحة.' }} /><RedirectsManager/></main>}
