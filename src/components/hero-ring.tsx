'use client';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { mediaSrc } from '@/lib/types';
import { useLanguage } from './language-provider';

export type RingItem = { id: string; name: string; href: string; image: string; cutout: boolean };

/**
 * Homepage ring: products on a circle that turns slowly. The product passing the front grows.
 * Touch stops it, a finger drag spins it (with a little momentum), a tap opens the product.
 * With "reduce motion" on it stays still (dragging still works). Positions are set straight on
 * the elements each frame, so React doesn't re-render while it turns.
 */
const RESUME_AFTER_MS = 2500;

export function HeroRing({ items, secondsPerTurn }: { items: RingItem[]; secondsPerTurn: number }) {
  const { language } = useLanguage();
  const ar = language === 'ar';
  const stage = useRef<HTMLDivElement>(null);
  const nodes = useRef<(HTMLAnchorElement | null)[]>([]);
  const angle = useRef(0); // radians the ring has turned
  const velocity = useRef(0); // radians per ms after a drag
  const holdUntil = useRef(0);
  const drag = useRef<{ x: number; t: number; moved: number; pointer: number } | null>(null);
  const suppressClick = useRef(false);
  const [front, setFront] = useState(0);
  const count = items.length;

  useEffect(() => {
    const el = stage.current;
    if (!el || !count) return;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const speed = (Math.PI * 2) / (secondsPerTurn * 1000); // radians per ms
    let frame = 0, last = performance.now(), lastFront = -1, visible = true;

    const layout = () => {
      const width = el.clientWidth;
      const radius = Math.min(width * 0.36, 360);
      let best = -Infinity, bestIndex = 0;
      for (let i = 0; i < count; i++) {
        const node = nodes.current[i];
        if (!node) continue;
        const theta = angle.current + (i / count) * Math.PI * 2;
        const depth = Math.cos(theta); // 1 = front, -1 = back
        const x = Math.sin(theta) * radius * (ar ? -1 : 1);
        const y = (1 - depth) * -18; // items at the back sit a little higher
        // Front item grows; the rest shrink with distance.
        const scale = 0.5 + 0.38 * (depth + 1) / 2 + Math.max(0, depth - 0.82) * 1.6;
        node.style.transform = `translate3d(calc(-50% + ${x.toFixed(1)}px), ${y.toFixed(1)}px, 0) scale(${scale.toFixed(3)})`;
        node.style.zIndex = String(Math.round((depth + 1) * 50));
        node.style.opacity = String(0.45 + 0.55 * (depth + 1) / 2);
        node.style.filter = depth < 0 ? `blur(${(-depth * 1.2).toFixed(2)}px)` : '';
        if (depth > best) { best = depth; bestIndex = i; }
      }
      if (bestIndex !== lastFront) { lastFront = bestIndex; setFront(bestIndex); }
    };

    const tick = (now: number) => {
      const dt = Math.min(64, now - last); last = now;
      if (!drag.current) {
        if (Math.abs(velocity.current) > 0.00001) { angle.current += velocity.current * dt; velocity.current *= Math.pow(0.94, dt / 16); }
        else if (!reduce && now > holdUntil.current) angle.current += speed * dt;
      }
      layout();
      frame = visible ? requestAnimationFrame(tick) : 0;
    };
    // Stop working while the ring is off screen or the tab is hidden.
    const io = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting && !document.hidden;
      if (visible && !frame) { last = performance.now(); frame = requestAnimationFrame(tick); }
    });
    io.observe(el);
    const onVisibility = () => { if (document.hidden) visible = false; else if (!frame) { visible = true; last = performance.now(); frame = requestAnimationFrame(tick); } };
    document.addEventListener('visibilitychange', onVisibility);
    layout();
    frame = requestAnimationFrame(tick);
    return () => { cancelAnimationFrame(frame); io.disconnect(); document.removeEventListener('visibilitychange', onVisibility); };
  }, [count, secondsPerTurn, ar]);

  if (!count) return null;
  const radiansPerPx = () => (Math.PI * 2) / Math.max(320, (stage.current?.clientWidth ?? 400) * 1.6);

  return <section className="hring" aria-roledescription="carousel" aria-label={ar ? 'منتجاتنا' : 'Our products'}>
    <h1 className="sr-only">{ar ? 'أور للجلود — منتجات جلدية طبيعية مصنوعة يدوياً' : 'UR Leather — handmade natural leather goods'}</h1>
    <div
      ref={stage}
      className="hring-stage"
      tabIndex={0}
      aria-label={ar ? 'اسحب لتدوير المنتجات، أو استعمل الأسهم' : 'Drag to turn the products, or use the arrow keys'}
      onPointerDown={e => {
        if (e.pointerType === 'mouse' && e.button !== 0) return;
        drag.current = { x: e.clientX, t: performance.now(), moved: 0, pointer: e.pointerId };
        velocity.current = 0; suppressClick.current = false;
        holdUntil.current = Number.POSITIVE_INFINITY;
      }}
      onPointerMove={e => {
        const d = drag.current;
        if (!d || d.pointer !== e.pointerId) return;
        const dx = e.clientX - d.x, now = performance.now();
        d.moved += Math.abs(dx);
        if (d.moved > 6 && !stage.current?.hasPointerCapture(e.pointerId)) stage.current?.setPointerCapture(e.pointerId);
        const delta = dx * radiansPerPx() * (ar ? -1 : 1);
        angle.current += delta;
        velocity.current = delta / Math.max(1, now - d.t);
        d.x = e.clientX; d.t = now;
      }}
      onPointerUp={e => {
        const d = drag.current; drag.current = null;
        if (d && d.moved > 6) suppressClick.current = true;
        if (stage.current?.hasPointerCapture(e.pointerId)) stage.current.releasePointerCapture(e.pointerId);
        holdUntil.current = performance.now() + RESUME_AFTER_MS;
      }}
      onPointerCancel={() => { drag.current = null; holdUntil.current = performance.now() + RESUME_AFTER_MS; }}
      onKeyDown={e => {
        if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
        e.preventDefault();
        velocity.current = 0; holdUntil.current = performance.now() + RESUME_AFTER_MS * 2;
        angle.current += ((e.key === 'ArrowRight') !== ar ? -1 : 1) * (Math.PI * 2) / count;
      }}
    >
      <div className="hring-floor" aria-hidden="true" />
      {items.map((item, i) => <Link
        key={`${item.id}-${i}`}
        href={item.href}
        prefetch={false}
        ref={node => { nodes.current[i] = node; }}
        className={`hring-item${i === front ? ' is-front' : ''}${item.cutout ? ' is-cutout' : ''}`}
        aria-label={item.name}
        draggable={false}
        onClick={e => { if (suppressClick.current) { e.preventDefault(); suppressClick.current = false; } }}
      >
        <img src={mediaSrc(item.image, 640)} srcSet={`${mediaSrc(item.image, 480)} 480w, ${mediaSrc(item.image, 640)} 640w, ${mediaSrc(item.image, 960)} 960w`} sizes="(max-width: 767px) 60vw, 360px" alt="" draggable={false} loading={i < 4 ? 'eager' : 'lazy'} fetchPriority={i === 0 ? 'high' : undefined} decoding="async" />
        <span className="hring-shadow" aria-hidden="true" />
      </Link>)}
    </div>
  </section>;
}
