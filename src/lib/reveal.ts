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

/** A horizontal rail the card sits in (it clips anything moving up or down inside it). */
function railOf(el: HTMLElement) {
  for (let node = el.parentElement; node && node !== document.body; node = node.parentElement) {
    const x = getComputedStyle(node).overflowX;
    if (x === 'auto' || x === 'scroll') return node;
  }
  return null;
}

export function useRevealOnScroll(ref: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const card = ref.current;
    if (!card || typeof IntersectionObserver === 'undefined' || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    // In a sideways rail the whole row rises together; moving single cards there makes them look cut and wavy.
    const rail = railOf(card);
    const el = rail ?? card;
    if (rail && rail.dataset.reveal) return;
    if (el.getBoundingClientRect().top < window.innerHeight) return; // on screen already
    if (rail) rail.dataset.reveal = '1';
    el.classList.add('reveal-pending');
    const io = shared();
    io.observe(el);
    return () => { io.unobserve(el); el.classList.remove('reveal-pending', 'reveal-in'); el.style.removeProperty('--reveal-delay'); if (rail) delete rail.dataset.reveal; };
  }, [ref]);
}
