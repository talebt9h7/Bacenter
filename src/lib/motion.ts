'use client';
import type { MouseEvent } from 'react';
/**
 * Two hand-made storefront motions, no animation library:
 *
 * flyToCart — the product photo flies on a curve from where it was added to the bag icon in the
 * header, shrinking as it goes; the bag then bounces. The copy lives in a layer on <body> (so no
 * list or card can clip it) and is always removed when the flight ends.
 *
 * openProduct — "open container": the tapped product card grows into the product page (its photo
 * becomes the page's big photo) using the browser's View Transitions; plain navigation elsewhere.
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
  const bag = bagIcon();
  const from = source.getBoundingClientRect();
  if (!bag || from.width < 4) return Promise.resolve(false);
  const to = bag.getBoundingClientRect();

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

type ViewTransitionDocument = Document & { startViewTransition?: (update: () => Promise<void>) => { finished: Promise<void> } };

/**
 * Opens a product page with the card growing into it. `card` is the product card, `photo` its
 * picture; the product page names its own big photo and content the same way (product-card.css).
 */
export function openProduct(event: MouseEvent, href: string, card: HTMLElement | null, photo: HTMLElement | null, push: (href: string) => void) {
  const doc = document as ViewTransitionDocument;
  if (!doc.startViewTransition || reduced() || event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || !card || !photo) return;
  event.preventDefault();
  // Only one element per page may carry a name: hand the names to this card for the snapshot.
  const pagePhoto = document.querySelector<HTMLElement>('.product-main-image');
  const pageBody = document.querySelector<HTMLElement>('.product-detail-layout');
  if (pagePhoto) pagePhoto.style.viewTransitionName = 'none';
  if (pageBody) pageBody.style.viewTransitionName = 'none';
  card.style.viewTransitionName = 'product-container';
  photo.style.viewTransitionName = 'product-photo';
  document.documentElement.dataset.vt = 'product';
  const path = href.split('?')[0];
  const transition = doc.startViewTransition(() => new Promise<void>(resolve => {
    card.style.viewTransitionName = '';
    photo.style.viewTransitionName = '';
    push(href);
    const started = performance.now();
    const wait = () => {
      const target = document.querySelector('.product-main-image');
      if ((location.pathname === path && target && target !== pagePhoto) || performance.now() - started > 2500) resolve();
      else requestAnimationFrame(wait);
    };
    requestAnimationFrame(wait);
  }));
  transition.finished.finally(() => { delete document.documentElement.dataset.vt; if (pagePhoto) pagePhoto.style.viewTransitionName = ''; if (pageBody) pageBody.style.viewTransitionName = ''; });
}
