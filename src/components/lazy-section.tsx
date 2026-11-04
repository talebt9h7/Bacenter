'use client';
import { useEffect, useRef, useState, type ReactNode } from 'react';

/**
 * Mounts its content only when the visitor scrolls near it (or opens the page at its #anchor).
 * Until then it is an empty box of `minHeight`, so the page doesn't jump. Used for heavy
 * sections at the end of a page whose code then downloads and runs only if they're reached.
 */
export function LazySection({ id, minHeight, rootMargin = '600px', children }: { id?: string; minHeight: number; rootMargin?: string; children: () => ReactNode }) {
  const box = useRef<HTMLDivElement>(null);
  const [show, setShow] = useState(false);
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const wanted = !!id && window.location.hash === `#${id}`;
    if (wanted || typeof IntersectionObserver === 'undefined') { const frame = requestAnimationFrame(() => setShow(true)); return () => cancelAnimationFrame(frame); }
    const io = new IntersectionObserver(entries => { if (entries.some(e => e.isIntersecting)) { setShow(true); io.disconnect(); } }, { rootMargin });
    io.observe(el);
    return () => io.disconnect();
  }, [id, rootMargin]);
  // Opened at #id: bring the section into view once it has rendered.
  useEffect(() => {
    if (!show || !id || window.location.hash !== `#${id}`) return;
    // The section's code arrives a moment later; wait for it (up to 4 s), then scroll.
    let tries = 0;
    const timer = setInterval(() => {
      const el = document.getElementById(id);
      if (el || ++tries > 40) { clearInterval(timer); el?.scrollIntoView({ block: 'start' }); }
    }, 100);
    return () => clearInterval(timer);
  }, [show, id]);
  if (show) return <>{children()}</>;
  return <div ref={box} id={id} style={{ minHeight }} aria-hidden="true" />;
}
