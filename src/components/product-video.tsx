'use client';
import { ReelPlayer } from './reel-player';

/** YouTube video for a product (vertical Short / reels frame by default) that plays while on screen. */
export function ProductVideo({ id, title, heading, language, wide = false }: { id: string; title: string; heading: string; language: string; wide?: boolean }) {
  return <section className={`product-video ${wide ? 'product-video-wide' : 'product-video-short'}`} aria-label={title}>
    {heading && <h2>{heading}</h2>}
    <ReelPlayer id={id} title={title} language={language} />
  </section>;
}
