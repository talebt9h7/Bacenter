'use client';
import Link from 'next/link';
import { useCallback, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import { useLanguage } from './language-provider';
import { storeT } from '@/lib/i18n';
import { ReelPlayer } from './reel-player';

type Story = { youtubeId: string; title: string; titleAr?: string; cta: string; ctaAr?: string; href: string; active: boolean; sortOrder: number };

/**
 * Home page reels: vertical YouTube videos in a swipeable rail. Only the most visible one plays
 * (muted, with a sound button); it pauses when it scrolls or swipes away.
 */
export function VideoStories({ stories: inputStories }: { stories: Story[] }) {
  const { language } = useLanguage(); const t = (label: string) => storeT(label, language);
  const ar = language === 'ar';
  const stories = [...inputStories].filter(item => item.active).sort((a, b) => a.sortOrder - b.sortOrder);
  const rail = useRef<HTMLDivElement>(null);
  const ratios = useRef<number[]>([]);
  const [current, setCurrent] = useState(-1);
  const onVisibility = useCallback((index: number, ratio: number) => {
    ratios.current[index] = ratio;
    let best = -1, bestRatio = 0.5;
    ratios.current.forEach((r, i) => { if (r >= bestRatio && (best === -1 || r > ratios.current[best])) { best = i; bestRatio = r; } });
    setCurrent(best);
  }, []);
  if (!stories.length) return null;
  const scroll = (dir: 1 | -1) => { const el = rail.current; if (!el) return; const step = (el.firstElementChild as HTMLElement | null)?.offsetWidth ?? 300; el.scrollBy({ left: (ar ? -dir : dir) * (step + 14), behavior: 'smooth' }); };
  return <section className="video-stories-section reels-section">
    <div className="section-heading"><h2>{t('Lights. Camera. Action.')}</h2>{stories.length > 1 && <div className="rail-controls"><button aria-label={t('Previous video stories')} onClick={() => scroll(-1)}>{ar ? <ArrowRight size={19} /> : <ArrowLeft size={19} />}</button><button aria-label={t('Next video stories')} onClick={() => scroll(1)}>{ar ? <ArrowLeft size={19} /> : <ArrowRight size={19} />}</button></div>}</div>
    <div className={`reels-rail ${stories.length === 1 ? 'is-single' : ''}`} ref={rail}>
      {stories.map((item, index) => { const title = ar ? (item.titleAr || item.title) : item.title; const cta = ar ? (item.ctaAr || item.cta) : item.cta; return <article className="reel-card" key={item.youtubeId}>
        <ReelPlayer id={item.youtubeId} title={title || 'UR'} language={language} active={current === index} onVisibility={ratio => onVisibility(index, ratio)} className="reel-frame" />
        {(title || (item.href && cta)) && <div className="reel-meta">{title && <h3>{title}</h3>}{item.href && cta && <Link href={item.href}>{cta} {ar ? <ArrowLeft size={13} /> : <ArrowRight size={13} />}</Link>}</div>}
      </article>; })}
    </div>
  </section>;
}
