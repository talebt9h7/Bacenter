'use client';
import { useEffect, type RefObject } from 'react';

/**
 * Staggered reveal on scroll for product cards: a card that starts below the screen waits
 * hidden and fades up when it scrolls in; cards arriving together follow each other by 70 ms.
 * Cards already on screen (and everything with reduced motion or no JavaScript) just show.
 * One shared observer serves every card on the page.
 */
let observer: IntersectionObserver | null = null;

function shared() {
  if (observer) return observer;
  observer = new IntersectionObserver(entries => {
    let i = 0;
    for (const e of entries) {
      if (!e.isIntersecting) continue;
      const el = e.target as HTMLElement;
      el.style.setProperty('--reveal-delay', `${Math.min(i++, 4) * 70}ms`);
      el.classList.add('reveal-in');
      observer?.unobserve(el);
    }
  }, { rootMargin: '0px 0px -6% 0px' });
  return observer;
}

export function useRevealOnScroll(ref: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === 'undefined' || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    if (el.getBoundingClientRect().top < window.innerHeight) return; // on screen already
    el.classList.add('reveal-pending');
    const io = shared();
    io.observe(el);
    return () => { io.unobserve(el); el.classList.remove('reveal-pending', 'reveal-in'); el.style.removeProperty('--reveal-delay'); };
  }, [ref]);
}
