'use client';
import { useEffect } from 'react';

/**
 * Light "reveal on scroll" for the homepage: section headings and the brand story fade up
 * (0.35 s) as they come into view. Anything already on screen at load is left alone, so the
 * first view never waits; nothing animates for people who ask their phone for reduced motion,
 * and without JavaScript everything simply shows.
 */
const TARGETS = '.section-heading, .brand-story .brand-latin, .brand-story h2:not(.sr-only), .brand-story-line, .brand-values > li, .brand-story .text-link';

export function ScrollReveal({ selector = TARGETS }: { selector?: string }) {
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches || typeof IntersectionObserver === 'undefined') return;
    const items = [...document.querySelectorAll<HTMLElement>(selector)].filter(el => el.getBoundingClientRect().top > window.innerHeight);
    if (!items.length) return;
    // Siblings in the same row (the brand values) follow each other by 80 ms.
    items.forEach(el => {
      const siblings = el.parentElement ? [...el.parentElement.children].filter(c => items.includes(c as HTMLElement)) : [];
      const i = siblings.indexOf(el);
      if (i > 0) el.style.setProperty('--reveal-delay', `${Math.min(i, 4) * 80}ms`);
      el.classList.add('reveal-pending');
    });
    const io = new IntersectionObserver(entries => {
      for (const e of entries) if (e.isIntersecting) { e.target.classList.add('reveal-in'); io.unobserve(e.target); }
    }, { rootMargin: '0px 0px -8% 0px' });
    items.forEach(el => io.observe(el));
    return () => { io.disconnect(); items.forEach(el => { el.classList.remove('reveal-pending', 'reveal-in'); el.style.removeProperty('--reveal-delay'); }); };
  }, [selector]);
  return null;
}
