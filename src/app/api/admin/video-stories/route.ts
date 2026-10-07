import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { asc, eq } from 'drizzle-orm';
import { db } from '@/db';
import { videoStories } from '@/db/schema';
import { requireAdminSection } from '@/lib/admin-auth';
import { ensureStoreSeeded } from '@/lib/settings';
export const dynamic = 'force-dynamic';
const clean=(v:unknown,max=300)=>String(v??'').trim().slice(0,max);
const out=(x:any,i=0)=>({id:x.id,youtubeId:clean(x.youtubeId,32),title:clean(x.title,180),titleAr:clean(x.titleAr,180),cta:clean(x.cta,100),ctaAr:clean(x.ctaAr,100),href:clean(x.href||'/',400),active:x.active!==false,sortOrder:Number.isFinite(Number(x.sortOrder))?Math.round(Number(x.sortOrder)):i});
export async function GET(){if(!(await requireAdminSection('storefront','view')))return NextResponse.json({error:'Forbidden'},{status:403});await ensureStoreSeeded();const rows=await db.select().from(videoStories).orderBy(asc(videoStories.sortOrder),asc(videoStories.id));return NextResponse.json({stories:rows.map(out)});}
export async function POST(r:NextRequest){if(!(await requireAdminSection('storefront','manage')))return NextResponse.json({error:'Forbidden'},{status:403});await ensureStoreSeeded();const b=await r.json().catch(()=>({}));const v=out(b);if(!v.youtubeId)return NextResponse.json({error:'YouTube video ID is required.'},{status:400});const [created]=await db.insert(videoStories).values({youtubeId:v.youtubeId,title:v.title,titleAr:v.titleAr||v.title,cta:v.cta,ctaAr:v.ctaAr||'شاهد الآن',href:v.href,active:v.active,sortOrder:v.sortOrder}).returning();return NextResponse.json({story:out(created)},{status:201});}
export async function PUT(r:NextRequest){if(!(await requireAdminSection('storefront','manage')))return NextResponse.json({error:'Forbidden'},{status:403});await ensureStoreSeeded();const b=await r.json().catch(()=>({}));const id=Number(b.id);if(!Number.isInteger(id))return NextResponse.json({error:'Invalid story id.'},{status:400});const v=out(b);if(!v.youtubeId)return NextResponse.json({error:'YouTube video ID is required.'},{status:400});const [updated]=await db.update(videoStories).set({youtubeId:v.youtubeId,title:v.title,titleAr:v.titleAr||v.title,cta:v.cta,ctaAr:v.ctaAr||'شاهد الآن',href:v.href,active:v.active,sortOrder:v.sortOrder,updatedAt:new Date()}).where(eq(videoStories.id,id)).returning();if(!updated)return NextResponse.json({error:'Video story not found.'},{status:404});return NextResponse.json({story:out(updated)});}
export async function DELETE(r:NextRequest){
  if(!(await requireAdminSection('storefront','manage')))return NextResponse.json({error:'Forbidden'},{status:403});
  const b=await r.json().catch(()=>({}));
  const id=Number(b.id);
  if(!Number.isInteger(id))return NextResponse.json({error:'Invalid story id.'},{status:400});
  const deleted=await db.delete(videoStories).where(eq(videoStories.id,id)).returning({id:videoStories.id});
  if(!deleted.length)return NextResponse.json({error:'Video story not found.'},{status:404});
  // Keep ordering clean after a deletion. This also prevents stale order gaps
  // from becoming visible when stories are added later.
  const remaining=await db.select({id:videoStories.id}).from(videoStories).orderBy(asc(videoStories.sortOrder),asc(videoStories.id));
  for(let i=0;i<remaining.length;i++)await db.update(videoStories).set({sortOrder:i,updatedAt:new Date()}).where(eq(videoStories.id,remaining[i].id));
  revalidatePath('/');
  revalidatePath('/admin/videos');
  return NextResponse.json({ok:true,deletedId:id});
}
