import { notFound, redirect } from 'next/navigation';
import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { urlRedirects } from '@/db/schema';
export const dynamic='force-dynamic';
export default async function RedirectFallback({params}:{params:Promise<{slug:string[]}>}){const p=await params;const source='/' + p.slug.join('/');const [row]=await db.select().from(urlRedirects).where(eq(urlRedirects.sourcePath,source));if(row?.active)redirect(row.destinationPath);notFound()}
