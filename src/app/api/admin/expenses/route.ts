import { NextRequest, NextResponse } from 'next/server';
import { requireAdminSection } from '@/lib/admin-auth';
import { resources } from '@/lib/admin-resources';
export const dynamic='force-dynamic';
export async function POST(request:NextRequest){
 if(!(await requireAdminSection('finance','manage'))) return NextResponse.redirect(new URL('/admin/login',request.url));
 const form=await request.formData();
 const body=Object.fromEntries(form.entries());
 const result=await resources.expenses.create?.(body);
 if(!result || result.error) return NextResponse.json({error:result?.error||'Could not create expense.'},{status:400});
 return NextResponse.redirect(new URL('/admin/finance',request.url));
}
