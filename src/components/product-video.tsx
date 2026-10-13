'use client';
import { useState } from 'react';
import { Play } from 'lucide-react';

/** YouTube video for a product (vertical Short / reels frame by default): a light thumbnail until tapped, then the privacy-friendly embed. */
export function ProductVideo({ id, title, heading, language, wide = false }: { id: string; title: string; heading: string; language: string; wide?: boolean }) {
  const [playing, setPlaying] = useState(false);
  return <section className={`product-video ${wide ? 'product-video-wide' : 'product-video-short'}`} aria-label={title}>
    {heading && <h2>{heading}</h2>}
    <div className="product-video-frame">
      {playing
        ? <iframe src={`https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0&playsinline=1&loop=1&playlist=${id}&modestbranding=1`} title={title} allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen />
        : <button type="button" onClick={() => setPlaying(true)} aria-label={language === 'ar' ? `تشغيل الفيديو: ${title}` : `Play video: ${title}`}>
            <img src={`https://i.ytimg.com/vi/${id}/hqdefault.jpg`} alt="" loading="lazy" />
            <span className="product-video-play"><Play size={28} fill="currentColor" /></span>
          </button>}
    </div>
  </section>;
}
