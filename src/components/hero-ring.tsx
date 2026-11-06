'use client';
import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, ChevronLeft, ChevronRight } from 'lucide-react';
import { mediaSrc } from '@/lib/types';
import type { HeroRingHeading, RingItem } from '@/lib/hero-ring';
import { useLanguage } from './language-provider';

/**
 * Homepage ring: products standing on a tilted circle that turns slowly, the one at the front
 * biggest and lit. It eases a little as each product passes the front, so every one gets a
 * moment. Touch or hover holds it; a drag spins it and it settles on the nearest product; a tap
 * on a side product brings it to the front, a tap on the front one opens it. With "reduce
 * motion" it stays still. Positions are written straight onto the elements each frame (no React
 * re-render while it turns) and only transform/opacity change, so it stays on the GPU.
 */
const TURN = Math.PI * 2;
const RESUME_AFTER_MS = 2600;
const DWELL = 0.38; // speed at the front, relative to the speed between two products
const INTRO_MS = 1150;

type Drag = { id: number; x: number; y: number; lastX: number; active: boolean; samples: { t: number; a: number }[] };
type Motion = { angle: number; target: number | null; tau: number; holdUntil: number; hover: boolean; drag: Drag | null; suppressClick: boolean; front: number; introStart: number; wake: () => void };

export type HeroRingProps = { items: RingItem[]; secondsPerTurn: number; heading: HeroRingHeading; caption: boolean; formatPrice: (iqd: number) => string; preview?: boolean };

export function HeroRing({ items, secondsPerTurn, heading, caption, formatPrice, preview = false }: HeroRingProps) {
  const { language } = useLanguage();
  const ar = language === 'ar';
  const count = items.length;
  const step = TURN / Math.max(1, count);
  const stage = useRef<HTMLDivElement>(null);
  const nodes = useRef<(HTMLAnchorElement | null)[]>([]);
  const m = useRef<Motion>({ angle: 0, target: null, tau: 180, holdUntil: 0, hover: false, drag: null, suppressClick: false, front: 0, introStart: -1, wake: () => {} });
  const [front, setFront] = useState(0);
  const cards = !items.every(item => item.cutout);

  /** Turn so that product `index` comes to the front, the short way round. */
  const goTo = useCallback((index: number) => {
    const mo = m.current;
    const base = mo.target ?? mo.angle;
    const k = Math.round((base - index * step) / TURN);
    mo.target = index * step + k * TURN;
    mo.tau = 190; mo.holdUntil = performance.now() + RESUME_AFTER_MS + 800;
    mo.wake();
  }, [step]);
  const goStep = useCallback((delta: number) => {
    const mo = m.current;
    mo.target = (Math.round((mo.target ?? mo.angle) / step) + delta) * step;
    mo.tau = 190; mo.holdUntil = performance.now() + RESUME_AFTER_MS + 800;
    mo.wake();
  }, [step]);

  useEffect(() => {
    const el = stage.current;
    if (!el || !count) return;
    const mo = m.current;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (mo.introStart < 0) mo.introStart = reduce ? 0 : performance.now();
    const speed = TURN / (secondsPerTurn * 1000) / Math.sqrt(DWELL); // radians per ms, before easing
    const side = ar ? -1 : 1;
    let width = 0, rx = 0, ry = 0, frame = 0, last = performance.now(), visible = true;
    let lastAngle = NaN, lastIntro = NaN;

    const measure = () => {
      width = el.clientWidth;
      // Same numbers as hero-ring.css (container widths below / above 768px).
      rx = width < 768 ? width * 0.4 : Math.min(width * 0.36, 520);
      ry = rx * (width < 768 ? 0.15 : 0.13);
      for (const node of nodes.current) {
        const img = node?.querySelector('img');
        if (node && img?.naturalWidth) node.style.setProperty('--ar', (img.naturalWidth / img.naturalHeight).toFixed(3));
      }
      lastAngle = NaN;
    };

    const layout = (now: number) => {
      const p = mo.introStart === 0 ? 1 : Math.min(1, (now - mo.introStart) / INTRO_MS);
      const e = 1 - Math.pow(1 - p, 3);
      const angle = mo.angle - (1 - e) * 0.85;
      if (angle === lastAngle && e === lastIntro) return;
      lastAngle = angle; lastIntro = e;
      const spread = 0.2 + 0.8 * e;
      let best = -2, bestIndex = mo.front;
      for (let i = 0; i < count; i++) {
        const node = nodes.current[i];
        if (!node) continue;
        const theta = i * step - angle;
        const depth = Math.cos(theta); // 1 = front, -1 = back
        const t = (depth + 1) / 2;
        const x = Math.sin(theta) * rx * spread * side;
        const y = depth * ry * spread; // the front stands lowest, the back highest
        const scale = (0.36 + 0.64 * t * t) * (0.86 + 0.14 * e);
        node.style.transform = `translate3d(${x.toFixed(1)}px,${y.toFixed(1)}px,0) scale(${scale.toFixed(4)})`;
        node.style.opacity = Math.min(1, 0.12 + 1.15 * t).toFixed(3); // the back fades into the light
        node.style.zIndex = String(Math.round(t * 1000));
        if (depth > best) { best = depth; bestIndex = i; }
      }
      if (bestIndex !== mo.front) { mo.front = bestIndex; setFront(bestIndex); }
    };

    const tick = (now: number) => {
      const dt = Math.min(64, now - last); last = now;
      const introDone = mo.introStart === 0 || now - mo.introStart >= INTRO_MS;
      if (!mo.drag?.active) {
        if (mo.target !== null) {
          const diff = mo.target - mo.angle;
          if (reduce || Math.abs(diff) < 0.0004) { mo.angle = mo.target; mo.target = null; }
          else mo.angle += diff * (1 - Math.exp(-dt / mo.tau));
        } else if (!reduce && introDone && !mo.hover && now > mo.holdUntil) {
          const phase = mo.angle / step - Math.floor(mo.angle / step);
          const s = Math.sin(Math.PI * phase);
          mo.angle += speed * (DWELL + (1 - DWELL) * s * s) * dt;
        }
      }
      layout(now);
      const idle = reduce && !mo.drag && mo.target === null;
      frame = visible && !idle ? requestAnimationFrame(tick) : 0;
    };
    mo.wake = () => { if (!frame && visible) { last = performance.now(); frame = requestAnimationFrame(tick); } };

    // Stop working while the ring is off screen or the tab is hidden.
    const io = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting && !document.hidden; if (visible) mo.wake(); });
    io.observe(el);
    const onVisibility = () => { visible = !document.hidden; if (visible) mo.wake(); };
    document.addEventListener('visibilitychange', onVisibility);
    const ro = new ResizeObserver(() => { measure(); layout(performance.now()); mo.wake(); });
    ro.observe(el);
    measure();
    layout(performance.now());
    frame = requestAnimationFrame(tick);
    return () => { cancelAnimationFrame(frame); frame = 0; mo.wake = () => {}; io.disconnect(); ro.disconnect(); document.removeEventListener('visibilitychange', onVisibility); };
  }, [count, secondsPerTurn, ar, step]);

  if (!count) return null;
  const release = (pointer: number) => {
    const mo = m.current, d = mo.drag;
    if (!d || d.id !== pointer) return;
    mo.drag = null;
    if (stage.current?.hasPointerCapture(pointer)) stage.current.releasePointerCapture(pointer);
    if (!d.active) return; // a tap: the product's own click decides
    mo.suppressClick = true; setTimeout(() => { mo.suppressClick = false; }, 0);
    const a = d.samples[0], b = d.samples[d.samples.length - 1];
    const velocity = b.t > a.t ? (b.a - a.a) / (b.t - a.t) : 0; // radians per ms
    mo.target = Math.round((mo.angle + velocity * 260) / step) * step; // flick, then settle on a product
    mo.tau = 210; mo.holdUntil = performance.now() + RESUME_AFTER_MS;
    mo.wake();
  };

  const name = (item: RingItem) => (ar ? item.nameAr : item.name);
  const current = items[Math.min(front, count - 1)];
  const eyebrow = ar ? heading.eyebrowAr : heading.eyebrow;
  const title = (ar ? heading.titleAr : heading.title) || (ar ? 'أور للجلود' : 'UR Leather');
  const subtitle = ar ? heading.subtitleAr : heading.subtitle;
  const cta = ar ? heading.ctaAr : heading.cta;
  const Title = preview ? 'div' : 'h1'; // the admin page has its own h1
  const Arrow = ar ? ArrowLeft : ArrowRight;
  const Prev = ar ? ChevronRight : ChevronLeft;
  const Next = ar ? ChevronLeft : ChevronRight;

  return <section className={`hring${cards ? ' is-cards' : ''}`} aria-roledescription="carousel" aria-label={ar ? 'منتجاتنا' : 'Our products'}>
    {heading.show ? <div className="hring-copy">
      {eyebrow && <div className="hring-eyebrow">{eyebrow}</div>}
      <Title className="hring-title">{title}</Title>
      {subtitle && <div className="hring-sub">{subtitle}</div>}
      {cta && <Link className="hring-cta" href={heading.href} prefetch={false} onClick={e => { if (preview) e.preventDefault(); }}>{cta}<Arrow size={16} strokeWidth={2} /></Link>}
    </div> : !preview && <h1 className="sr-only">{ar ? 'أور للجلود — منتجات جلدية طبيعية مصنوعة يدوياً' : 'UR Leather — handmade natural leather goods'}</h1>}

    <div
      ref={stage}
      className="hring-stage"
      tabIndex={0}
      aria-label={ar ? 'اسحب لتدوير المنتجات، أو استعمل الأسهم' : 'Drag to turn the products, or use the arrow keys'}
      onPointerEnter={e => { if (e.pointerType === 'mouse') m.current.hover = true; }}
      onPointerLeave={e => { if (e.pointerType === 'mouse') { m.current.hover = false; m.current.holdUntil = Math.max(m.current.holdUntil, performance.now() + 700); } }}
      onPointerDown={e => {
        if (e.pointerType === 'mouse' && e.button !== 0) return;
        if ((e.target as HTMLElement).closest('.hring-nav')) return;
        m.current.drag = { id: e.pointerId, x: e.clientX, y: e.clientY, lastX: e.clientX, active: false, samples: [{ t: performance.now(), a: m.current.angle }] };
      }}
      onPointerMove={e => {
        const mo = m.current, d = mo.drag;
        if (!d || d.id !== e.pointerId) return;
        if (!d.active) {
          const dx = e.clientX - d.x, dy = e.clientY - d.y;
          if (Math.abs(dx) < 7 && Math.abs(dy) < 7) return;
          if (Math.abs(dy) > Math.abs(dx)) { mo.drag = null; return; } // the page is being scrolled
          d.active = true; d.lastX = e.clientX; mo.target = null; mo.holdUntil = Number.POSITIVE_INFINITY;
          stage.current?.setPointerCapture(e.pointerId);
          mo.wake();
        }
        const w = stage.current?.clientWidth ?? 390;
        mo.angle += (e.clientX - d.lastX) * (step / (w * 0.42)) * (ar ? 1 : -1);
        d.lastX = e.clientX;
        const now = performance.now();
        d.samples.push({ t: now, a: mo.angle });
        while (d.samples.length > 2 && now - d.samples[0].t > 90) d.samples.shift();
      }}
      onPointerUp={e => release(e.pointerId)}
      onPointerCancel={e => release(e.pointerId)}
      onKeyDown={e => {
        if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
        e.preventDefault();
        goStep((e.key === 'ArrowRight') !== ar ? 1 : -1);
      }}
    >
      <span className="hring-glow" aria-hidden="true" />
      <span className="hring-orbit" aria-hidden="true" />
      {!cards && <span className="hring-spot" aria-hidden="true" />}
      {items.map((item, i) => <Link
        key={`${item.id}-${i}`}
        href={item.href}
        prefetch={false}
        ref={node => { nodes.current[i] = node; }}
        className={`hring-item${i === front ? ' is-front' : ''}`}
        style={{ zIndex: count - i }}
        aria-label={name(item)}
        tabIndex={i === front ? 0 : -1}
        draggable={false}
        onClick={e => {
          const mo = m.current;
          if (mo.suppressClick) { e.preventDefault(); return; }
          if (i !== mo.front) { e.preventDefault(); goTo(i); return; }
          if (preview) e.preventDefault();
        }}
      >
        <span className="hring-shadow" aria-hidden="true" />
        {cards
          ? <span className="hring-card"><img src={mediaSrc(item.image, 480)} srcSet={`${mediaSrc(item.image, 320)} 320w, ${mediaSrc(item.image, 480)} 480w, ${mediaSrc(item.image, 640)} 640w`} sizes="(max-width: 767px) 45vw, 290px" alt="" draggable={false} loading={i < 3 ? 'eager' : 'lazy'} fetchPriority={i === 0 ? 'high' : undefined} decoding="async" /></span>
          : <img src={mediaSrc(item.image, 640)} srcSet={`${mediaSrc(item.image, 480)} 480w, ${mediaSrc(item.image, 640)} 640w, ${mediaSrc(item.image, 960)} 960w`} sizes="(max-width: 767px) 56vw, 360px" alt="" draggable={false} loading={i < 3 ? 'eager' : 'lazy'} fetchPriority={i === 0 ? 'high' : undefined} decoding="async" onLoad={e => { const img = e.currentTarget; if (img.naturalWidth) img.parentElement?.style.setProperty('--ar', (img.naturalWidth / img.naturalHeight).toFixed(3)); }} />}
      </Link>)}
      {count > 1 && <>
        <button type="button" className="hring-nav hring-prev" aria-label={ar ? 'المنتج السابق' : 'Previous product'} onClick={() => goStep(-1)}><Prev size={22} strokeWidth={1.6} /></button>
        <button type="button" className="hring-nav hring-next" aria-label={ar ? 'المنتج التالي' : 'Next product'} onClick={() => goStep(1)}><Next size={22} strokeWidth={1.6} /></button>
      </>}
    </div>

    <div className="hring-foot">
      {caption && current && <div className="hring-caption" key={current.id} aria-live="polite"><b>{name(current)}</b><span>{current.priceVaries ? (ar ? 'من ' : 'From ') : ''}{formatPrice(current.priceIqd)}</span></div>}
      {count > 1 && <div className="hring-dots">{items.map((item, i) => <button key={`${item.id}-${i}`} type="button" aria-label={ar ? `${name(item)} (${i + 1} من ${count})` : `${name(item)} (${i + 1} of ${count})`} aria-current={i === front} onClick={() => goTo(i)} />)}</div>}
    </div>
  </section>;
}
