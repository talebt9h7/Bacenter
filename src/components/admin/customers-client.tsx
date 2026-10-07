'use client';

import Link from 'next/link';
import { MessageCircle, PackageOpen, Repeat2, ShoppingBag, Users, WalletCards } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useLanguage } from '@/components/language-provider';
import { iqd, when } from '@/lib/format';

const T = {
  en: {
    eyebrow:'People · CRM', title:'Customers', desc:'Understand what each customer bought, when they bought it, and follow up with relevant offers.',
    all:'All customers', wallets:'Wallet buyers', bags:'Bag buyers', repeat:'Repeat buyers', accessories:'Accessory buyers',
    search:'Search name, phone or email…', aria:'Search customers', filter:'Filter', clear:'Clear', customers:'customers',
    segment:'Segment', hint:'Use segments to find customers for relevant follow-ups. WhatsApp opens with a ready-to-edit message; nothing is sent automatically.',
    customer:'Customer', contact:'Contact', segments:'Segments', governorate:'Governorate', orders:'Orders', spend:'Product spend', last:'Last purchase', actions:'Actions', profile:'Profile',
    walletBuyer:'Wallet buyer', bagBuyer:'Bag buyer', accessoryBuyer:'Accessory buyer', repeatTag:'Repeat', since:'Since', noMatch:'No customers match this segment.',
    wa:'WhatsApp',
    inactive:'No purchase in 90+ days', boughtWallets:'Bought wallets', boughtBags:'Bought bags', boughtAccessories:'Bought accessories'
  },
  ar: {
    eyebrow:'العملاء · إدارة علاقات العملاء', title:'العملاء', desc:'افهم ما الذي اشتراه كل عميل ومتى، وتابع معه بالعروض المناسبة.',
    all:'كل العملاء', wallets:'عملاء المحافظ', bags:'عملاء الحقائب', repeat:'العملاء المتكررون', accessories:'عملاء الإكسسوارات',
    search:'ابحث بالاسم أو الهاتف أو البريد الإلكتروني…', aria:'البحث عن العملاء', filter:'تصفية', clear:'مسح', customers:'عميل',
    segment:'الشريحة', hint:'استخدم الشرائح للعثور على العملاء المناسبين للمتابعة. يفتح واتساب برسالة جاهزة للتعديل، ولا يتم إرسال أي شيء تلقائياً.',
    customer:'العميل', contact:'بيانات التواصل', segments:'الشرائح', governorate:'المحافظة', orders:'الطلبات', spend:'إنفاق المنتجات', last:'آخر شراء', actions:'الإجراءات', profile:'الملف الشخصي',
    walletBuyer:'عميل محافظ', bagBuyer:'عميل حقائب', accessoryBuyer:'عميل إكسسوارات', repeatTag:'متكرر', since:'منذ', noMatch:'لا يوجد عملاء يطابقون هذه الشريحة.',
    wa:'واتساب', inactive:'بدون شراء لأكثر من 90 يوماً', boughtWallets:'اشترى محافظ', boughtBags:'اشترى حقائب', boughtAccessories:'اشترى إكسسوارات'
  }
} as const;

type Row = {
  id:number; name:string; phone:string; email:string|null; governorate:string|null; ordersCount:number; totalSpent:number;
  lastOrderAt:string|Date|null; createdAt:string|Date; tags:string[]|null; categories:string[];
};

type Props = { rows: Row[]; zones: { code:string; nameEn:string; nameAr?:string|null }[]; initialQuery:string; initialSegment:string };

export function CustomersClient({ rows, zones, initialQuery, initialSegment }: Props) {
  const { language } = useLanguage();
  const t = T[language];
  const [q, setQ] = useState(initialQuery);
  const [segment, setSegment] = useState(initialSegment || 'all');
  const segmentOptions = useMemo(() => [
    ['all',t.all],['wallets',t.boughtWallets],['bags',t.boughtBags],['accessories',t.boughtAccessories],['repeat',t.repeat],['inactive',t.inactive]
  ] as const, [t]);
  const zoneName = (code:string|null) => {
    const zone = zones.find(z=>z.code===code);
    return language === 'ar' ? (zone?.nameAr || zone?.nameEn || code || '—') : (zone?.nameEn || code || '—');
  };
  const visible = rows.filter(row => {
    const query = q.trim().toLowerCase();
    const matchQ = !query || `${row.name} ${row.phone} ${row.email ?? ''}`.toLowerCase().includes(query);
    const cats = row.categories;
    const matchSegment = segment==='wallets' ? cats.includes('wallets') : segment==='bags' ? cats.some(c=>['backpacks','crossbody-bags','tote-bags','work-bags','luggage'].includes(c)) : segment==='accessories' ? cats.includes('accessories') : segment==='repeat' ? row.ordersCount>=2 : segment==='inactive' ? (row.lastOrderAt ? Date.now()-new Date(row.lastOrderAt).getTime() >= 90*24*60*60*1000 : false) : true;
    return matchQ && matchSegment;
  });
  const counts = {
    all: rows.length,
    wallets: rows.filter(r=>r.categories.includes('wallets')).length,
    bags: rows.filter(r=>r.categories.some(c=>['backpacks','crossbody-bags','tote-bags','work-bags','luggage'].includes(c))).length,
    repeat: rows.filter(r=>r.ordersCount>=2).length,
  };
  const activeLabel = segmentOptions.find(x=>x[0]===segment)?.[1] ?? t.all;
  return <main className="admin-page">
    <div className="admin-page-heading"><div><span className="admin-eyebrow">{t.eyebrow}</span><h1>{t.title}</h1><p>{t.desc}</p></div></div>
    <div className="admin-stats admin-stats-4">
      <div className="admin-stat"><Users size={18}/><span>{t.all}</span><strong>{counts.all}</strong></div>
      <div className="admin-stat"><WalletCards size={18}/><span>{t.wallets}</span><strong>{counts.wallets}</strong></div>
      <div className="admin-stat"><ShoppingBag size={18}/><span>{t.bags}</span><strong>{counts.bags}</strong></div>
      <div className="admin-stat"><Repeat2 size={18}/><span>{t.repeat}</span><strong>{counts.repeat}</strong></div>
    </div>
    <section className="admin-card">
      <div className="admin-toolbar">
        <label className="admin-search"><input value={q} onChange={e=>setQ(e.target.value)} placeholder={t.search} aria-label={t.aria}/></label>
        <select value={segment} onChange={e=>setSegment(e.target.value)} className="admin-filter-select" aria-label={t.segment}>{segmentOptions.map(([value,label])=><option key={value} value={value}>{label}</option>)}</select>
        {(q||segment!=='all')&&<button className="admin-btn admin-btn-ghost admin-btn-sm" type="button" onClick={()=>{setQ('');setSegment('all')}}>{t.clear}</button>}
        <span className="admin-count">{visible.length} {t.customers} · {activeLabel}</span>
      </div>
      <div className="admin-segment-hint"><PackageOpen size={15}/><span>{t.hint}</span></div>
      <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>{t.customer}</th><th>{t.contact}</th><th>{t.segments}</th><th>{t.governorate}</th><th className="num">{t.orders}</th><th className="num">{t.spend}</th><th>{t.last}</th><th>{t.actions}</th></tr></thead><tbody>
        {visible.map(row=>{
          const labels=[row.categories.includes('wallets')?t.walletBuyer:'',row.categories.some(c=>['backpacks','crossbody-bags','tote-bags','work-bags','luggage'].includes(c))?t.bagBuyer:'',row.categories.includes('accessories')?t.accessoryBuyer:'',row.ordersCount>=2?t.repeatTag:''].filter(Boolean);
          const wa=`https://wa.me/964${row.phone.replace(/^0/,'')}?text=${encodeURIComponent(`هلا ${row.name} 👋\nحبيت نشاركك آخر المنتجات الجديدة عندنا. إذا تحب أرسل لك الخيارات المتوفرة.`)}`;
          return <tr key={row.id}><td><Link href={`/admin/customers/${row.id}`} className="admin-strong-link">{row.name}</Link><br/><small>{t.since} {new Date(row.createdAt).toLocaleDateString(language==='ar'?'ar-IQ':'en-GB',{dateStyle:'medium'})}</small></td><td><a href={`tel:${row.phone}`}>{row.phone}</a>{row.email&&<><br/><small>{row.email}</small></>}</td><td><div className="admin-tag-list">{labels.map(label=><span key={label} className="admin-tag static">{label}</span>)}{row.tags?.map(tag=><span key={tag} className="admin-tag static">{tag}</span>)}</div></td><td>{zoneName(row.governorate)}</td><td className="num">{row.ordersCount}</td><td className="num"><strong>{iqd(row.totalSpent)}</strong></td><td><small>{row.lastOrderAt?when(row.lastOrderAt):'—'}</small></td><td className="num"><Link className="admin-link" href={`/admin/customers/${row.id}`}>{t.profile}</Link> · <a className="admin-link" href={wa} target="_blank" rel="noreferrer"><MessageCircle size={13}/> {t.wa}</a></td></tr>
        })}
        {!visible.length&&<tr><td colSpan={8}><p className="admin-empty">{t.noMatch}</p></td></tr>}
      </tbody></table></div>
    </section>
  </main>;
}
