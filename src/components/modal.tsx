'use client';
import { useEffect, useRef, type ReactNode } from 'react';
import { X } from 'lucide-react';

export function Modal({ children, onClose, title, className = '' }: { children: ReactNode; onClose: () => void; title: string; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const close = useRef(onClose);
  close.current = onClose;
  useEffect(() => {
    const originalOverflow = document.body.style.overflow;
    const previous = document.activeElement as HTMLElement | null;
    document.body.style.overflow = 'hidden';
    const timer = setTimeout(() => {
      const initial = ref.current?.querySelector<HTMLElement>('[data-autofocus], input, button, a[href]');
      (initial || ref.current)?.focus();
    }, 50);
    function keydown(event: KeyboardEvent) {
      if (event.key === 'Escape') close.current();
      if (event.key !== 'Tab') return;
      const focusables = Array.from(ref.current?.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), input, select, textarea, [tabindex="0"]') || []).filter(el => el.getClientRects().length);
      const first = focusables[0]; const last = focusables[focusables.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    }
    document.addEventListener('keydown', keydown);
    return () => { clearTimeout(timer); document.body.style.overflow = originalOverflow; document.removeEventListener('keydown', keydown); previous?.focus(); };
  }, []);
  return <div className={`modal-overlay ${className}`} onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}>
    <div ref={ref} className="modal-panel" role="dialog" aria-modal="true" aria-label={title} tabIndex={-1}>
      {children}
    </div>
  </div>;
}
export function ModalHeading({ title, onClose, count }: { title: string; onClose: () => void; count?: number }) {
  return <div className="modal-heading"><h2>{title}{count !== undefined && <span> ({count})</span>}</h2><button className="icon-button" onClick={onClose} aria-label="Close dialog"><X size={23} strokeWidth={1.5} /></button></div>;
}
