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
 * openProduct / playProductOpen — "open container": the tapped card's photo grows into the
 * product page's big photo and the details slide up.
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
 * "Open container", without covering the screen: tapping a card only remembers where its photo
 * was and lets the link navigate as usual (prefetched, so normally instant). When the product page
 * appears, it grows its big photo out of that spot and slides the details up (playProductOpen).
 * Nothing is drawn while the page loads, so a slow network never shows a frozen copy.
 */
type PendingOpen = { left: number; top: number; width: number; height: number; at: number; path: string; src: string; played: boolean };
let pendingOpen: PendingOpen | null = null;

export function openProduct(event: MouseEvent, href: string, card: HTMLElement | null, photo: HTMLImageElement | null) {
  if (reduced() || event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || !photo) return;
  const r = photo.getBoundingClientRect();
  if (r.width < 20) return;
  pendingOpen = { left: r.left, top: r.top, width: r.width, height: r.height, at: performance.now(), path: href.split('?')[0], src: photo.currentSrc || photo.src, played: false };
  card?.classList.add('is-opening');
  window.setTimeout(() => card?.classList.remove('is-opening'), 600);
}

/** The tapped card's photo, for the loading screen to show while the page comes (null if none). */
export function pendingOpenPhoto() {
  const from = pendingOpen;
  return from && !reduced() && performance.now() - from.at < 4000 ? from.src : null;
}

function grow(photo: HTMLElement, from: PendingOpen) {
  // Open at the top ourselves: Next.js skips its scroll-to-top when the new photo already looks on screen (it is, mid-animation).
  window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
  const to = photo.getBoundingClientRect();
  if (to.width < 20) return false;
  const toTop = to.top;
  const scale = Math.max(from.width / to.width, from.height / to.height);
  const dx = from.left + from.width / 2 - (to.left + to.width / 2);
  const dy = from.top + from.height / 2 - (toTop + to.height / 2);
  photo.animate([
    { transform: `translate(${dx}px, ${dy}px) scale(${scale})`, borderRadius: '22px' },
    { transform: 'none', borderRadius: '0px' },
  ], { duration: 460, easing: 'cubic-bezier(.2,.8,.2,1)' });
  return true;
}

/** Loading screen: its photo area grows out of the tapped card straight away. */
export function playLoadingOpen(photo: HTMLElement | null) {
  const from = pendingOpen;
  if (!from || !photo || from.played || reduced() || location.pathname !== from.path) return;
  from.played = grow(photo, from);
}

/** Product page on mount: the big photo grows out of the tapped card (unless the loading screen already did) and the details slide up. */
export function playProductOpen(photo: HTMLElement | null, rest: HTMLElement[]) {
  const from = pendingOpen;
  pendingOpen = null;
  if (!from || !photo || reduced() || location.pathname !== from.path || performance.now() - from.at > 6000) return;
  if (from.played) window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
  if (!from.played && !grow(photo, from)) return;
  const ease = 'cubic-bezier(.2,.8,.2,1)';
  const delay = from.played ? 0 : 140;
  rest.forEach((el, i) => el.animate([{ opacity: 0, transform: 'translateY(28px)' }, { opacity: 1, transform: 'none' }], { duration: 420, delay: delay + i * 50, easing: ease, fill: 'backwards' }));
}
