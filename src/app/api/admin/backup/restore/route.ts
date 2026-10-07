import { NextResponse } from 'next/server';
import { db, pool } from '@/db';
import { activityLog } from '@/db/schema';
import { getAdminActor } from '@/lib/admin-auth';
export const dynamic='force-dynamic'; export const runtime='nodejs';
function quote(i:string){return `"${i.replaceAll('"','""')}"`}
function decode(v:unknown):unknown{if(Array.isArray(v))return v.map(decode);if(v&&typeof v==='object'){const o=v as Record<string,unknown>;if(o.__type==='bytea'&&typeof o.value==='string')return Buffer.from(o.value,'base64');const out:Record<string,unknown>={};for(const[k,x]of Object.entries(o))out[k]=decode(x);return out}return v}
type Backup={format:string;version:number;createdAt:string;tables:Record<string,unknown[]>};
type T={name:string};
type FK={child:string;parent:string};
function orderTables(tables:T[],fks:FK[]){const names=tables.map(t=>t.name), deps=new Map<string,Set<string>>();for(const n of names)deps.set(n,new Set());for(const f of fks)if(deps.has(f.child)&&deps.has(f.parent)&&f.child!==f.parent)deps.get(f.child)!.add(f.parent);const out:string[]=[];const remaining=new Set(names);while(remaining.size){let progressed=false;for(const n of [...remaining]){const d=deps.get(n)!;if([...d].every(x=>!remaining.has(x))){out.push(n);remaining.delete(n);progressed=true}}if(!progressed){out.push(...remaining);break}}return out}
export async function POST(request:Request){
 const actor=await getAdminActor();if(!actor||actor.type!=='owner')return NextResponse.json({error:'Owner access required'},{status:403});
 const form=await request.formData(),file=form.get('file'),confirmation=form.get('confirmation');
 if(!(file instanceof File))return NextResponse.json({error:'Backup file is required'},{status:400});if(confirmation!=='RESTORE')return NextResponse.json({error:'Type RESTORE to confirm'},{status:400});if(file.size>50*1024*1024)return NextResponse.json({error:'Backup file is too large (50 MB maximum)'},{status:400});
 let backup:Backup;try{backup=JSON.parse(await file.text())}catch{return NextResponse.json({error:'Invalid JSON backup file'},{status:400})};
 if(!backup||backup.format!=='bellroy-admin-backup'||backup.version!==1||!backup.tables||typeof backup.tables!=='object')return NextResponse.json({error:'Unsupported or invalid Bellroy backup'},{status:400});
 const client=await pool.connect();try{
  const current=await client.query<T>(`select table_name as name from information_schema.tables where table_schema='public' and table_type='BASE TABLE' order by table_name`);const allowed=new Set(current.rows.map(x=>x.name));
  if(Object.keys(backup.tables).some(n=>!allowed.has(n)))return NextResponse.json({error:'Backup contains tables that do not exist in this project'},{status:400});
  const fkRows=await client.query<FK>(`select tc.table_name as child, ccu.table_name as parent from information_schema.table_constraints tc join information_schema.constraint_column_usage ccu on ccu.constraint_name=tc.constraint_name and ccu.table_schema=tc.table_schema where tc.table_schema='public' and tc.constraint_type='FOREIGN KEY'`);
  const insertionOrder=orderTables(current.rows,fkRows.rows);await client.query('BEGIN');
  await client.query(`TRUNCATE ${current.rows.map(t=>`public.${quote(t.name)}`).join(', ')} RESTART IDENTITY CASCADE`);
  for(const name of insertionOrder){const rows=backup.tables[name];if(!Array.isArray(rows))continue;for(const raw of rows){const row=decode(raw) as Record<string,unknown>,cols=Object.keys(row);if(!cols.length)continue;await client.query(`insert into public.${quote(name)} (${cols.map(quote).join(', ')}) values (${cols.map((_,i)=>`$${i+1}`).join(', ')})`,cols.map(c=>row[c]))}}
  const serials=await client.query<{table_name:string;column_name:string;sequence_name:string}>(`select table_name,column_name,pg_get_serial_sequence(format('%I.%I',table_schema,table_name),column_name) as sequence_name from information_schema.columns where table_schema='public' and pg_get_serial_sequence(format('%I.%I',table_schema,table_name),column_name) is not null`);
  for(const s of serials.rows)if(s.sequence_name)await client.query(`select setval($1::regclass,coalesce((select max(${quote(s.column_name)}) from public.${quote(s.table_name)}),1),(select count(*)>0 from public.${quote(s.table_name)}))`,[s.sequence_name]);
  await client.query('COMMIT');try{await db.insert(activityLog).values({action:'restore',entity:'database',details:`Restored backup created ${backup.createdAt}`})}catch{}return NextResponse.json({ok:true,message:'Backup restored successfully'});
 }catch(e){try{await client.query('ROLLBACK')}catch{}return NextResponse.json({error:e instanceof Error?e.message:'Restore failed'},{status:500})}finally{client.release()}
}
