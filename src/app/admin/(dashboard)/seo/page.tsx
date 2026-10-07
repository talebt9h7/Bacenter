import { redirect } from 'next/navigation';
import { requireAdminSection } from '@/lib/admin-auth';
import { getSettings } from '@/lib/settings';
import { SeoManager } from '@/components/admin/seo-manager';
export const dynamic='force-dynamic';
export const metadata={title:'SEO'};
export default async function SeoPage(){const actor=await requireAdminSection('configuration','view'); if(!actor)redirect('/admin'); const s=await getSettings(); return <main className="admin-page"><div className="admin-page-heading"><div><span className="admin-eyebrow">Configuration</span><h1>SEO</h1><p>Control search indexing, metadata, canonical URLs and social sharing defaults.</p></div></div><SeoManager initial={{metaTitle:s.metaTitle,metaDescription:s.metaDescription,seoIndex:s.seoIndex,seoFollow:s.seoFollow,canonicalBaseUrl:s.canonicalBaseUrl,ogImage:s.ogImage}}/></main>}
