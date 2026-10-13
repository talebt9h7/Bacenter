'use client';
import { useEffect } from 'react';
import { useLanguage } from '@/components/language-provider';
import { ADMIN_AR, ADMIN_AR_PATTERNS } from '@/lib/admin-ar';

const SKIP = 'input, textarea, select, option, code, pre, script, style, [contenteditable], [data-raw], .admin-nav-brand';
function translate(text: string) {
  const key = text.trim();
  if (!key || !/[A-Za-z]/.test(key)) return null;
  const hit = ADMIN_AR[key];
  if (hit) return text.replace(key, hit);
  for (const [re, out] of ADMIN_AR_PATTERNS) if (re.test(key)) return text.replace(key, key.replace(re, out));
  return null;
}
function run(root: Node) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT);
  let node: Node | null = root;
  while (node) {
    if (node.nodeType === Node.TEXT_NODE) {
      const parent = node.parentElement;
      if (parent && !parent.closest(SKIP)) { const next = translate(node.nodeValue ?? ''); if (next !== null && next !== node.nodeValue) node.nodeValue = next; }
    } else if (node instanceof HTMLElement) {
      if (node.matches('input[placeholder], textarea[placeholder]')) { const next = translate(node.getAttribute('placeholder') ?? ''); if (next) node.setAttribute('placeholder', next); }
      for (const attr of ['title', 'aria-label']) { const v = node.getAttribute(attr); if (v) { const next = translate(v); if (next) node.setAttribute(attr, next); } }
    }
    node = walker.nextNode();
  }
}

/**
 * Arabic admin: translates interface words that are still English in the markup (and English
 * status values stored in the database) after React renders, and keeps doing it as pages update.
 */
export function AdminArabic() {
  const { language } = useLanguage();
  useEffect(() => {
    if (language !== 'ar') return;
    const main = document.querySelector('.admin-main');
    if (!main) return;
    run(main);
    let queued = false;
    const observer = new MutationObserver(() => {
      if (queued) return; queued = true;
      requestAnimationFrame(() => { queued = false; observer.disconnect(); run(main); observer.observe(main, { childList: true, subtree: true, characterData: true }); });
    });
    observer.observe(main, { childList: true, subtree: true, characterData: true });
    return () => observer.disconnect();
  }, [language]);
  return null;
}
