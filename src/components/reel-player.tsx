'use client';
import { useEffect, useRef, useState } from 'react';
import { Volume2, VolumeX } from 'lucide-react';

type Command = 'playVideo' | 'pauseVideo' | 'mute' | 'unMute';

/**
 * A YouTube video in a reels frame that plays (muted) while it is on screen and pauses when it
 * scrolls away. Browsers only allow autoplay without sound, so a button turns the sound on.
 * The player loads only when the frame gets close to the screen.
 *
 * `active` lets a parent pick one video out of several (e.g. the most visible one in a rail);
 * without it the video decides by its own visibility. `onVisibility` reports how much is visible.
 */
export function ReelPlayer({ id, title, language, active, onVisibility, className = '' }: { id: string; title: string; language: string; active?: boolean; onVisibility?: (ratio: number) => void; className?: string }) {
  const box = useRef<HTMLDivElement>(null);
  const frame = useRef<HTMLIFrameElement>(null);
  const [load, setLoad] = useState(false);
  const [muted, setMuted] = useState(true);
  const ratio = useRef(0);
  const ready = useRef(false);
  const activeRef = useRef(active);
  const report = useRef(onVisibility);
  useEffect(() => { report.current = onVisibility; }, [onVisibility]);
  const send = (func: Command) => { try { frame.current?.contentWindow?.postMessage(JSON.stringify({ event: 'command', func, args: [] }), '*'); } catch { /* not ready */ } };
  const shouldPlay = () => ratio.current >= 0.5 && activeRef.current !== false && !document.hidden;
  const sync = () => { if (ready.current) send(shouldPlay() ? 'playVideo' : 'pauseVideo'); };

  useEffect(() => { activeRef.current = active; sync(); }, [active]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const el = box.current; if (!el) return;
    const near = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setLoad(true); near.disconnect(); } }, { rootMargin: '400px 400px' });
    const seen = new IntersectionObserver(([e]) => { ratio.current = e.intersectionRatio; report.current?.(e.intersectionRatio); sync(); }, { threshold: [0, 0.25, 0.5, 0.75, 1] });
    near.observe(el); seen.observe(el);
    document.addEventListener('visibilitychange', sync);
    return () => { near.disconnect(); seen.disconnect(); document.removeEventListener('visibilitychange', sync); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function onLoad() {
    try { frame.current?.contentWindow?.postMessage(JSON.stringify({ event: 'listening', id }), '*'); } catch { /* ignore */ }
    ready.current = true;
    send('mute');
    sync();
  }
  function toggleSound() { const next = !muted; setMuted(next); send(next ? 'mute' : 'unMute'); if (!next) send('playVideo'); }
  const ar = language === 'ar';
  const origin = typeof window === 'undefined' ? '' : `&origin=${encodeURIComponent(window.location.origin)}`;

  return <div className={`product-video-frame ${className}`} ref={box}>
    <img className="product-video-poster" src={`https://i.ytimg.com/vi/${id}/hqdefault.jpg`} alt="" loading="lazy" />
    {load && <iframe ref={frame} onLoad={onLoad} src={`https://www.youtube-nocookie.com/embed/${id}?enablejsapi=1&mute=1&playsinline=1&rel=0&loop=1&playlist=${id}&modestbranding=1&controls=1${origin}`} title={title} allow="autoplay; encrypted-media; picture-in-picture; accelerometer; gyroscope" allowFullScreen />}
    <button type="button" className="product-video-sound" onClick={toggleSound} aria-label={muted ? (ar ? 'تشغيل الصوت' : 'Turn sound on') : (ar ? 'كتم الصوت' : 'Mute')}>{muted ? <VolumeX size={18} /> : <Volume2 size={18} />}<span>{muted ? (ar ? 'تشغيل الصوت' : 'Sound on') : (ar ? 'كتم' : 'Mute')}</span></button>
  </div>;
}
