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
 // Streamed one table at a time: the whole database (images included) is never held in
 // memory as a single string, and the download starts immediately. The file format is unchanged.
 const encoder=new TextEncoder();
 const stream=new ReadableStream<Uint8Array>({async start(controller){
  try{
   controller.enqueue(encoder.encode(`{"format":"store-admin-backup","version":1,"createdAt":${JSON.stringify(new Date().toISOString())},"tables":{`));
   for(const [index,t] of ts.rows.entries()){
    const r=await pool.query(`select * from public.${quote(t.name)}`);
    controller.enqueue(encoder.encode(`${index?',':''}${JSON.stringify(t.name)}:[`));
    for(const [i,row] of r.rows.entries())controller.enqueue(encoder.encode(`${i?',':''}${JSON.stringify(encode(row))}`));
    controller.enqueue(encoder.encode(']'));
   }
   controller.enqueue(encoder.encode('}}'));
   controller.close();
   try{await db.insert(activityLog).values({action:'backup',entity:'database',details:`Backup created (${ts.rows.length} tables)`})}catch{}
  }catch(error){controller.error(error)}
 }});
 return new NextResponse(stream,{headers:{'content-type':'application/json; charset=utf-8','content-disposition':`attachment; filename="store-backup-${new Date().toISOString().replace(/[:.]/g,'-')}.json`,'cache-control':'no-store'}});
}
