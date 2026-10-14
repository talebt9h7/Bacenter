'use client';
import { useEffect, useRef, useState } from 'react';
import { Volume2, VolumeX } from 'lucide-react';

type Command = 'playVideo' | 'pauseVideo' | 'mute' | 'unMute';

/**
 * YouTube video for a product (vertical Short / reels frame by default). It starts playing, muted,
 * when it scrolls into view and pauses when it leaves — browsers only allow autoplay without sound,
 * so a button turns the sound on. The player is only loaded once the video is close to the screen.
 */
export function ProductVideo({ id, title, heading, language, wide = false }: { id: string; title: string; heading: string; language: string; wide?: boolean }) {
  const box = useRef<HTMLDivElement>(null);
  const frame = useRef<HTMLIFrameElement>(null);
  const [load, setLoad] = useState(false);
  const [muted, setMuted] = useState(true);
  const visible = useRef(false);
  const ready = useRef(false);
  const send = (func: Command) => { try { frame.current?.contentWindow?.postMessage(JSON.stringify({ event: 'command', func, args: [] }), '*'); } catch { /* not ready */ } };

  useEffect(() => {
    const el = box.current; if (!el) return;
    // Load the player a little before it is reached, play/pause by visibility.
    const near = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setLoad(true); near.disconnect(); } }, { rootMargin: '400px 0px' });
    const seen = new IntersectionObserver(([e]) => {
      visible.current = e.intersectionRatio >= 0.5;
      if (ready.current) send(visible.current ? 'playVideo' : 'pauseVideo');
    }, { threshold: [0, 0.5, 1] });
    near.observe(el); seen.observe(el);
    const hidden = () => { if (document.hidden) send('pauseVideo'); else if (visible.current && ready.current) send('playVideo'); };
    document.addEventListener('visibilitychange', hidden);
    return () => { near.disconnect(); seen.disconnect(); document.removeEventListener('visibilitychange', hidden); };
  }, []);

  function onLoad() {
    // Subscribe to the player so it accepts commands, then sync with the current visibility.
    try { frame.current?.contentWindow?.postMessage(JSON.stringify({ event: 'listening', id }), '*'); } catch { /* ignore */ }
    ready.current = true;
    send('mute');
    send(visible.current ? 'playVideo' : 'pauseVideo');
  }
  function toggleSound() { const next = !muted; setMuted(next); send(next ? 'mute' : 'unMute'); if (!next) send('playVideo'); }
  const ar = language === 'ar';
  const origin = typeof window === 'undefined' ? '' : `&origin=${encodeURIComponent(window.location.origin)}`;

  return <section className={`product-video ${wide ? 'product-video-wide' : 'product-video-short'}`} aria-label={title}>
    {heading && <h2>{heading}</h2>}
    <div className="product-video-frame" ref={box}>
      <img className="product-video-poster" src={`https://i.ytimg.com/vi/${id}/hqdefault.jpg`} alt="" loading="lazy" />
      {load && <iframe ref={frame} onLoad={onLoad} src={`https://www.youtube-nocookie.com/embed/${id}?enablejsapi=1&mute=1&playsinline=1&rel=0&loop=1&playlist=${id}&modestbranding=1&controls=1${origin}`} title={title} allow="autoplay; encrypted-media; picture-in-picture; accelerometer; gyroscope" allowFullScreen />}
      <button type="button" className="product-video-sound" onClick={toggleSound} aria-label={muted ? (ar ? 'تشغيل الصوت' : 'Turn sound on') : (ar ? 'كتم الصوت' : 'Mute')}>{muted ? <VolumeX size={18} /> : <Volume2 size={18} />}<span>{muted ? (ar ? 'تشغيل الصوت' : 'Sound on') : (ar ? 'كتم' : 'Mute')}</span></button>
    </div>
  </section>;
}
