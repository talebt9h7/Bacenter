'use client';
import Link from 'next/link';
import { ArrowLeft, ArrowRight, Gem, Hand, ShieldCheck, Truck } from 'lucide-react';
import { useStore } from './store-provider';
import { useLanguage } from './language-provider';

const ICONS = [Gem, Hand, ShieldCheck, Truck];
export function Ziggurat({ size = 22 }: { size?: number }) {
  return <svg viewBox="0 0 40 24" width={size} height={size * 0.6} aria-hidden="true"><path d="M2 22h36M6 22v-5h28v5M10 17v-5h20v5M14 12V7h12v5M18 7V3h4v4" fill="none" stroke="currentColor" strokeWidth="2" /></svg>;
}
const fallback = [
  { title: 'Genuine leather', titleAr: 'جلد طبيعي 100%', text: 'Full-grain leather that ages beautifully.', textAr: 'جلد طبيعي يزداد جمالاً مع الاستخدام.' },
  { title: 'Handmade', titleAr: 'صناعة يدوية', text: 'Cut and stitched by Iraqi craftsmen.', textAr: 'بأيدي حرفيين عراقيين مهرة.' },
  { title: '6-month warranty', titleAr: 'ضمان 6 أشهر', text: 'On stitching and materials.', textAr: 'على الخياطة وعيوب التصنيع.' },
  { title: 'Delivery across Iraq', titleAr: 'توصيل لكل العراق', text: 'Cash on delivery.', textAr: 'والدفع عند الاستلام.' },
];

/** The brand band under the hero: who UR is, in the brand's own type, with four promises. */
export function BrandStory({ showName = true }: { showName?: boolean }) {
  const { settings } = useStore();
  const { language } = useLanguage();
  const ar = language === 'ar';
  const values = (settings.homeValues?.length ? settings.homeValues : fallback).slice(0, 4);
  const line = ar ? (settings.homeHeadlineAr || 'جلد طبيعي عراقي — إرث سومري بروح معاصرة') : (settings.homeHeadline || 'Natural Iraqi leather — Sumerian heritage, made for today');
  const Arrow = ar ? ArrowLeft : ArrowRight;
  return <section className="brand-story" aria-label={ar ? 'عن أور' : 'About UR'}>
    <div className="brand-story-inner">
      <p className="brand-latin"><Ziggurat /> <span>UR LEATHER</span> <Ziggurat /></p>
      {showName ? <h2>أور للجلود</h2> : <h2 className="sr-only">أور للجلود</h2>}
      <p className="brand-story-line">{line}</p>
      <ul className="brand-values">{values.map((v, i) => { const Icon = ICONS[i % ICONS.length]; return <li key={i}><Icon size={24} strokeWidth={1.4} /><b>{ar ? v.titleAr || v.title : v.title}</b><span>{ar ? v.textAr || v.text : v.text}</span></li>; })}</ul>
      <Link className="text-link" href="/info/our-story">{ar ? 'قصة أور' : 'Our story'} <Arrow size={15} /></Link>
    </div>
  </section>;
}
