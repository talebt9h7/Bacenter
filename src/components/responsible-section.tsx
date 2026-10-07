'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { ArrowRight, Pause, Play } from 'lucide-react';
import { useStore } from './store-provider';
import { useLanguage } from './language-provider';
import { storeT } from '@/lib/i18n';
const fallbackValues = [
  { title: 'Better with age', description: 'Our gear is built to last and love – to day 1000 and beyond.' },
  { title: 'Considered materials', description: 'Our primary fabrics are made from recycled sources like plastic bottles.' },
  { title: 'Leather, crafted', description: 'We use leather from gold-rated LWG tanneries.' },
];
export function ResponsibleSection() {
  const { settings } = useStore();
  const { language } = useLanguage();
  const t = (label: string) => storeT(label, language);
  const values = settings.homeValues.length ? settings.homeValues.map(item => ({ title: item.title, description: item.text, titleAr: item.titleAr, descriptionAr: item.textAr })) : fallbackValues;
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);
  useEffect(() => { if (paused || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return; const timer = setInterval(() => setActive(index => (index + 1) % values.length), 6500); return () => clearInterval(timer); }, [paused, values.length]);
  return <section className="brand-values-section"><div className="brand-values-copy"><h2>{language === 'ar' ? 'بصفتنا مؤسسة B معتمدة، نستخدم الأعمال كقوة لصنع الخير. تعرّف أكثر علينا وعلى هدفنا.' : 'As a certified B Corporation, we use business as a force for good. Learn more about us and our purpose.'}</h2><Link className="text-link" href="/info/responsible-business">{t('Read about us')} <ArrowRight size={15} /></Link><div className="brand-value" aria-live="polite"><h3>{language === 'ar' ? (values[active % values.length].titleAr || values[active % values.length].title) : values[active % values.length].title}</h3><p>{language === 'ar' ? (values[active % values.length].descriptionAr || values[active % values.length].description) : values[active % values.length].description}</p></div><div className="brand-value-controls"><button onClick={() => setPaused(!paused)} aria-label={paused ? t('Play brand stories') : t('Pause brand stories')}>{paused ? <Play size={12} /> : <Pause size={12} />}</button>{values.map((item, index) => <button key={item.title} className={index === active ? 'active' : ''} onClick={() => { setActive(index); setPaused(true); }} aria-label={item.title} aria-pressed={index === active} />)}</div></div><img className="values-bottle" src="/images/story-bottle.png" alt={language === 'ar' ? 'عبوات بلاستيكية أُعيد استخدامها' : 'Plastic bottles given a second life'} loading="lazy" /><img className="values-fabric" src="/images/story-fabric.png" alt={language === 'ar' ? 'خامات منسوجة معاد تدويرها بعناية' : 'Considered, recycled woven materials'} loading="lazy" /></section>;
}
