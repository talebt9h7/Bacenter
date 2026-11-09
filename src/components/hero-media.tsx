'use client';
import Link from 'next/link';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import { mediaSrc } from '@/lib/types';
import type { HeroLayout, HeroMedia as Media, HeroMode, HeroRingHeading } from '@/lib/hero-ring';
import { useLanguage } from './language-provider';

/**
 * Homepage hero as one photo or a silent looping video (Admin → Homepage chooses it instead of
 * the product ring). The text and buttons sit over it where the admin placed them. The video
 * plays muted and inline; the photo is its poster and what shows with "reduce motion" or data saving.
 */
export function HeroMedia({ mode, media, layout, heading, preview = false }: { mode: HeroMode; media: Media; layout: HeroLayout; heading: HeroRingHeading; preview?: boolean }) {
  const { language } = useLanguage();
  const ar = language === 'ar';
  const eyebrow = ar ? heading.eyebrowAr : heading.eyebrow;
  const title = (ar ? heading.titleAr : heading.title) || (ar ? 'أور للجلود' : 'UR Leather');
  const subtitle = ar ? heading.subtitleAr : heading.subtitle;
  const cta = ar ? heading.ctaAr : heading.cta, cta2 = ar ? heading.cta2Ar : heading.cta2;
  const Title = preview ? 'div' : 'h1';
  const Arrow = ar ? ArrowLeft : ArrowRight;
  const wide = media.image || media.imageMobile, tall = media.imageMobile || media.image;
  const stop = (e: React.MouseEvent) => { if (preview) e.preventDefault(); };
  return <section className={`hmedia hmedia-x-${layout.x} hmedia-y-${layout.y}`} style={{ '--hmedia-shade': layout.shade / 100 } as React.CSSProperties} aria-label={ar ? 'واجهة المتجر' : 'Store hero'}>
    {wide && <picture className="hmedia-fill">
      <source media="(max-width: 767px)" srcSet={`${mediaSrc(tall, 640)} 640w, ${mediaSrc(tall, 960)} 960w`} sizes="100vw" />
      <img src={mediaSrc(wide, 1600)} srcSet={`${mediaSrc(wide, 960)} 960w, ${mediaSrc(wide, 1600)} 1600w, ${mediaSrc(wide, 2000)} 2000w`} sizes="100vw" alt="" fetchPriority="high" decoding="async" />
    </picture>}
    {mode === 'video' && media.video && <video className="hmedia-fill hmedia-video" src={media.video} poster={wide ? mediaSrc(wide, 960) : undefined} autoPlay muted loop playsInline preload="metadata" aria-hidden="true" />}
    <span className="hmedia-shade" aria-hidden="true" />
    {heading.show ? <div className="hmedia-copy">
      {eyebrow && <div className="hmedia-eyebrow">{eyebrow}</div>}
      <Title className="hmedia-title">{title}</Title>
      {subtitle && <div className="hmedia-sub">{subtitle}</div>}
      {(cta || cta2) && <div className="hmedia-actions">
        {cta && <Link className="hmedia-btn" href={heading.href} prefetch={false} onClick={stop}>{cta}<Arrow size={16} strokeWidth={2} /></Link>}
        {cta2 && <Link className="hmedia-btn hmedia-btn-ghost" href={heading.href2} prefetch={false} onClick={stop}>{cta2}</Link>}
      </div>}
    </div> : !preview && <h1 className="sr-only">{ar ? 'أور للجلود — منتجات جلدية طبيعية مصنوعة يدوياً' : 'UR Leather — handmade natural leather goods'}</h1>}
  </section>;
}
