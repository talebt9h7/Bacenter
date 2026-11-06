'use client';
import { useEffect, type RefObject } from 'react';

/** Phones only: the header slides away while scrolling down and comes back on any scroll up. */
export const HIDE_ON_SCROLL_QUERY = '(max-width: 767px)';
const HIDDEN = 'is-scroll-hidden';
const SHOW_AFTER_UP = 6; // px of upward scroll that brings it back
const HIDE_AFTER_DOWN = 12; // px of downward scroll that hides it
const ALWAYS_SHOWN_TOP = 80; // near the top of the page it always shows

/** Any part of the app can ask for the header back (e.g. a product flying to the bag icon). */
export function showHeader() {
  window.dispatchEvent(new Event('ur:show-header'));
}

/**
 * Like Instagram/YouTube: scrolling down (scrollY growing) hides the bar, scrolling up (scrollY
 * shrinking) shows it. Only a class is toggled — no re-render on scroll — and the header is
 * sticky, so the page content is already underneath it and fills the screen when it slides away.
 */
export function useHideOnScroll(ref: RefObject<HTMLElement | null>, keepShown: boolean) {
  useEffect(() => {
    const header = ref.current;
    if (!header) return;
    const phone = window.matchMedia(HIDE_ON_SCROLL_QUERY);
    let lastY = window.scrollY, travel = 0, frame = 0;
    const set = (hidden: boolean) => header.classList.toggle(HIDDEN, hidden);
    if (keepShown) set(false);
    const update = () => {
      frame = 0;
      const y = Math.max(0, window.scrollY);
      const delta = y - lastY; // > 0 = down, < 0 = up
      lastY = y;
      if (!phone.matches || keepShown || y < ALWAYS_SHOWN_TOP) { travel = 0; set(false); return; }
      // Count distance in one direction only; a change of direction starts over.
      travel = (travel > 0) === (delta > 0) ? travel + delta : delta;
      if (travel > HIDE_AFTER_DOWN) set(true);
      else if (travel < -SHOW_AFTER_UP) set(false);
    };
    const onScroll = () => { if (!frame) frame = requestAnimationFrame(update); };
    const onShow = () => { travel = 0; set(false); };
    const onQuery = () => { if (!phone.matches) set(false); };
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('ur:show-header', onShow);
    phone.addEventListener('change', onQuery);
    return () => { cancelAnimationFrame(frame); window.removeEventListener('scroll', onScroll); window.removeEventListener('ur:show-header', onShow); phone.removeEventListener('change', onQuery); };
  }, [ref, keepShown]);
}
