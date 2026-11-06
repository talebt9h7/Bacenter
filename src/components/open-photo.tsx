'use client';
import { useLayoutEffect, useRef, useState } from 'react';
import { pendingOpenPhoto, playLoadingOpen } from '@/lib/motion';

/** Inside the product loading screen: the tapped card's photo, already growing into place. */
export function OpenPhoto() {
  const ref = useRef<HTMLDivElement>(null);
  const [src] = useState(() => (typeof window === 'undefined' ? null : pendingOpenPhoto()));
  useLayoutEffect(() => { if (src) playLoadingOpen(ref.current?.parentElement ?? null); }, [src]);
  return src ? <div ref={ref} className="open-photo"><img src={src} alt="" /></div> : null;
}
