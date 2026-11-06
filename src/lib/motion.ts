'use client';
import type { MouseEvent } from 'react';
import { showHeader } from './hide-on-scroll';
/**
 * Two hand-made storefront motions, no animation library:
 *
 * flyToCart — the product photo flies on a curve from where it was added to the bag icon in the
 * header, shrinking as it goes; the bag then bounces. The copy lives in a layer on <body> (so no
 * list or card can clip it) and is always removed when the flight ends.
 *
 * openProduct — "open container": the tapped product card grows into the product page (its photo
 * becomes the page's big photo).
 */

const reduced = () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/** The bag icon currently on screen (the header has one per layout; hidden ones measure 0×0). */
function bagIcon(): HTMLElement | null {
  for (const el of document.querySelectorAll<HTMLElement>('.bag-trigger')) {
    const r = el.getBoundingClientRect();
    if (r.width > 0 && r.height > 0 && r.bottom > 0 && r.top < window.innerHeight) return el;
  }
  return null;
}

/** Where the bag will be: on phones a scrolled-away header is called back, and measured where it lands. */
function bagTarget(): DOMRect | null {
  const hidden = document.querySelector<HTMLElement>('.site-header.is-scroll-hidden');
  if (!hidden) return bagIcon()?.getBoundingClientRect() ?? null;
  hidden.style.transition = 'none';
  hidden.classList.remove('is-scroll-hidden');
  const rect = bagIcon()?.getBoundingClientRect() ?? null;
  hidden.classList.add('is-scroll-hidden');
  void hidden.offsetWidth;
  hidden.style.transition = '';
  showHeader(); // slides back in while the photo flies
  return rect;
}

/** Bounce the bag icon once (also used when no flight could run). */
export function bumpBag() {
  const bag = bagIcon();
  if (!bag) return;
  bag.classList.remove('is-bumped');
  void bag.offsetWidth; // restart the animation if it is still running
  bag.classList.add('is-bumped');
  window.setTimeout(() => bag.classList.remove('is-bumped'), 700);
}

/**
 * Flies `image` from `source` to the bag. Resolves true when it landed, false when it could not
 * run at all (no source or bag on screen, or reduced motion) so the caller can show the bag instead.
 */
export type FlySource = Element | null | undefined | (Element | null | undefined)[];
/** The first candidate that is actually on screen (a photo scrolled away falls back to the button). */
function onScreen(source: FlySource) {
  for (const el of Array.isArray(source) ? source : [source]) {
    const r = el?.getBoundingClientRect();
    if (el && r && r.width > 3 && r.bottom > 40 && r.top < window.innerHeight - 20) return el;
  }
  return null;
}

export function flyToCart(candidates: FlySource, image: string, onLand?: () => void): Promise<boolean> {
  const source = typeof window === 'undefined' ? null : onScreen(candidates);
  if (!source || reduced()) return Promise.resolve(false);
  const from = source.getBoundingClientRect();
  if (from.width < 4) return Promise.resolve(false);
  const to = bagTarget();
  if (!to) return Promise.resolve(false);

  // Start as a square on the photo's centre, at most 220px, so big product photos don't fly as walls.
  const size = Math.min(220, from.width, from.height);
  const x0 = from.left + from.width / 2, y0 = from.top + from.height / 2;
  const x2 = to.left + to.width / 2, y2 = to.top + to.height / 2;
  // Control point: halfway across, lifted above both ends -> one smooth arc.
  const x1 = (x0 + x2) / 2, y1 = Math.max(size * 0.35, Math.min(y0, y2) - Math.max(90, Math.abs(x2 - x0) * 0.35)); // never leaves the top of the screen
  const endScale = Math.max(0.08, (to.width * 0.9) / size);

  const flyer = document.createElement('img');
  flyer.src = image;
  flyer.alt = '';
  flyer.setAttribute('aria-hidden', 'true');
  flyer.className = 'fly-to-cart';
  Object.assign(flyer.style, { left: `${x0 - size / 2}px`, top: `${y0 - size / 2}px`, width: `${size}px`, height: `${size}px` });
  document.body.appendChild(flyer);

  // Quadratic Bézier, sampled into keyframes: B(t) = (1-t)²P0 + 2(1-t)tP1 + t²P2.
  const frames: Keyframe[] = [];
  const steps = 24;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps, u = 1 - t;
    const x = u * u * x0 + 2 * u * t * x1 + t * t * x2 - x0;
    const y = u * u * y0 + 2 * u * t * y1 + t * t * y2 - y0;
    const scale = 1 + (endScale - 1) * t * t; // stays big at first, shrinks into the bag
    frames.push({ transform: `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) scale(${scale.toFixed(3)})`, opacity: t > 0.85 ? 1 - (t - 0.85) / 0.15 * 0.6 : 1, offset: t });
  }
  const duration = Math.min(900, 560 + Math.hypot(x2 - x0, y2 - y0) * 0.35);

  return new Promise(resolve => {
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      flyer.remove(); // never leave the copy stuck above the page
      bumpBag();
      onLand?.();
      resolve(true);
    };
    const animation = flyer.animate(frames, { duration, easing: 'cubic-bezier(.45,.05,.55,.95)', fill: 'forwards' });
    animation.onfinish = finish;
    animation.oncancel = finish;
    window.setTimeout(finish, duration + 400); // safety net if the animation never reports back
  });
}

/**
 * Opens a product page with the card growing into it ("open container"), drawn by hand so it
 * behaves the same on iPhone and Android: a copy of the card is laid over the page, grows to the
 * full screen while its photo moves to where the product page shows it, the page loads underneath,
 * then the copy fades away. The copy is always removed (also on a slow or failed load).
 */
export function openProduct(event: MouseEvent, href: string, card: HTMLElement | null, photo: HTMLImageElement | null, push: (href: string) => void) {
  if (reduced() || event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || !card || !photo) return;
  const c = card.getBoundingClientRect(), ph = photo.getBoundingClientRect();
  if (c.width < 20 || ph.width < 20) return;
  event.preventDefault();
  const vw = window.innerWidth, vh = window.innerHeight;
  const radius = getComputedStyle(card).borderRadius || '18px';

  const layer = document.createElement('div');
  layer.className = 'open-container';
  layer.setAttribute('aria-hidden', 'true');
  Object.assign(layer.style, { left: `${c.left}px`, top: `${c.top}px`, width: `${c.width}px`, height: `${c.height}px`, borderRadius: radius });
  const img = document.createElement('img');
  img.src = photo.currentSrc || photo.src;
  img.alt = '';
  Object.assign(img.style, { left: `${ph.left}px`, top: `${ph.top}px`, width: `${ph.width}px`, height: `${ph.height}px` });
  document.body.append(layer, img);
  img.className = 'open-container-photo';

  // Where the product page shows its big photo (phones: full width under the header).
  const header = document.querySelector('.site-header')?.getBoundingClientRect();
  const top = vw < 768 ? Math.max(header?.bottom ?? 80, header?.height ?? 80) : 140; // the page opens at its top, header shown
  const w = vw < 768 ? vw : Math.min(vw * 0.55, 760), h = w / 1.05, left = vw < 768 ? 0 : (document.dir === 'rtl' ? vw - w - 40 : 40);
  const ease = 'cubic-bezier(.2,.8,.2,1)';
  const grow = 420;
  layer.animate([{ left: `${c.left}px`, top: `${c.top}px`, width: `${c.width}px`, height: `${c.height}px`, borderRadius: radius }, { left: '0px', top: '0px', width: `${vw}px`, height: `${vh}px`, borderRadius: '0px' }], { duration: grow, easing: ease, fill: 'forwards' });
  img.animate([{ left: `${ph.left}px`, top: `${ph.top}px`, width: `${ph.width}px`, height: `${ph.height}px` }, { left: `${left}px`, top: `${top}px`, width: `${w}px`, height: `${h}px` }], { duration: grow, easing: ease, fill: 'forwards' });

  let removed = false;
  const remove = () => { if (removed) return; removed = true; layer.remove(); img.remove(); };
  const fadeOut = () => {
    if (removed) return;
    const anims = [layer, img].map(el => el.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 220, easing: 'ease', fill: 'forwards' }));
    anims[0].onfinish = remove;
    window.setTimeout(remove, 400);
  };
  const path = href.split('?')[0];
  const started = performance.now();
  push(href);
  const wait = () => {
    if (removed) return;
    const target = location.pathname === path ? document.querySelector<HTMLElement>('.product-main-image') : null;
    if (target && performance.now() - started > grow) {
      // Land the photo exactly on the page's photo, then let the page show.
      const r = target.getBoundingClientRect();
      img.animate([{ left: `${r.left}px`, top: `${r.top}px`, width: `${r.width}px`, height: `${r.height}px` }], { duration: 160, easing: ease, fill: 'forwards' }).onfinish = fadeOut;
      window.setTimeout(fadeOut, 260);
    } else if (performance.now() - started > 8000) fadeOut();
    else requestAnimationFrame(wait);
  };
  requestAnimationFrame(wait);
}
