'use client';
import Link from 'next/link';
import { useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, Play } from 'lucide-react';
import { Modal, ModalHeading } from './modal';
import { useLanguage } from './language-provider';
import { storeT } from '@/lib/i18n';
type Story = { youtubeId: string; title: string; titleAr?: string; cta: string; ctaAr?: string; href: string; active: boolean; sortOrder: number };
export function VideoStories({ stories: inputStories }: { stories: Story[] }) {
  const { language } = useLanguage(); const t = (label: string) => storeT(label, language);
  const stories = [...inputStories].filter(item => item.active).sort((a, b) => a.sortOrder - b.sortOrder);
  const rail = useRef<HTMLDivElement>(null); const [playing, setPlaying] = useState<number | null>(null); const story = playing !== null ? stories[playing] : null;
  return <section className="video-stories-section"><div className="section-heading"><h2>{t('Lights. Camera. Action.')}</h2><div className="rail-controls"><button aria-label={t('Previous video stories')} onClick={() => rail.current?.scrollBy({ left: language === 'ar' ? 620 : -620, behavior: 'smooth' })}><ArrowLeft size={19} /></button><button aria-label={t('Next video stories')} onClick={() => rail.current?.scrollBy({ left: language === 'ar' ? -620 : 620, behavior: 'smooth' })}><ArrowRight size={19} /></button></div></div><div className="video-stories-rail" ref={rail}>{stories.map((item, index) => <article className="video-story-card" key={item.youtubeId}><button className="video-poster" aria-label={`${language === 'ar' ? 'تشغيل' : 'Play'} ${language === 'ar' ? (item.titleAr || item.title) : item.title}`} onClick={() => setPlaying(index)}><img src={`/images/video-${index + 1}.jpg`} alt={item.title} loading="lazy" /><span><Play size={23} fill="white" strokeWidth={0} /></span></button><h3>{language === 'ar' ? (item.titleAr || item.title) : item.title}</h3><Link href={item.href}>{language === 'ar' ? (item.ctaAr || item.cta) : item.cta} <ArrowRight size={12} /></Link></article>)}</div>{story && <Modal title={story.title} className="video-overlay" onClose={() => setPlaying(null)}><ModalHeading title={story.title} onClose={() => setPlaying(null)} /><iframe title={story.title} src={`https://www.youtube-nocookie.com/embed/${story.youtubeId}?autoplay=1&rel=0&playsinline=1`} allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowFullScreen referrerPolicy="strict-origin-when-cross-origin" /><div className="video-fallback"><a href={`https://www.youtube.com/watch?v=${story.youtubeId}`} target="_blank" rel="noreferrer">{t('Prefer to watch on YouTube?')} <ArrowRight size={14} /></a></div></Modal>}</section>;
}
