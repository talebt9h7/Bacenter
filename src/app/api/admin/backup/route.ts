import { NextResponse } from 'next/server';
import { db, pool } from '@/db';
import { activityLog } from '@/db/schema';
import { getAdminActor } from '@/lib/admin-auth';
export const dynamic = 'force-dynamic'; export const runtime = 'nodejs';
function quote(i:string){return `"${i.replaceAll('"','""')}"`}
function encode(v:unknown):unknown{if(Buffer.isBuffer(v))return{__type:'bytea',value:v.toString('base64')};if(Array.isArray(v))return v.map(encode);if(v&&typeof v==='object'){const o:Record<string,unknown>={};for(const[k,x]of Object.entries(v as Record<string,unknown>))o[k]=encode(x);return o}return v}
export async function GET(){
 const actor=await getAdminActor(); if(!actor||actor.type!=='owner')return NextResponse.json({error:'Owner access required'},{status:403});
 const ts=await pool.query<{name:string}>(`select table_name as name from information_schema.tables where table_schema='public' and table_type='BASE TABLE' order by table_name`);
 const tables:Record<string,unknown[]>={}; for(const t of ts.rows){const r=await pool.query(`select * from public.${quote(t.name)}`);tables[t.name]=r.rows.map(encode)}
 const backup={format:'bellroy-admin-backup',version:1,createdAt:new Date().toISOString(),tables};
 try{await db.insert(activityLog).values({action:'backup',entity:'database',details:`Backup created (${Object.keys(tables).length} tables)`})}catch{}
 return new NextResponse(JSON.stringify(backup),{headers:{'content-type':'application/json; charset=utf-8','content-disposition':`attachment; filename="bellroy-backup-${new Date().toISOString().replace(/[:.]/g,'-')}.json`,'cache-control':'no-store'}})
}
