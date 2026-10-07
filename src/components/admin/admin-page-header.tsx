'use client';
import { useLanguage } from '@/components/language-provider';
import { adminT, batchT } from '@/lib/i18n';
export function AdminPageHeader({section,title,description}:{section:string;title:string;description:string}){
 const {language}=useLanguage();
 return <div className="admin-page-heading"><div><span className="admin-eyebrow">{adminT(section as any,language)}</span><h1>{batchT(title,language)}</h1><p>{batchT(description,language)}</p></div></div>;
}
