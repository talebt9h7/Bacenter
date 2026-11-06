'use client';
import { groupInt, numberFormat } from '@/lib/number-format';
import { useLanguage } from './language-provider';
import { track } from '@/lib/track';

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useLocalStorageValue, writeLocalStorage } from '@/lib/use-local-storage';
import type { CartLine } from '@/lib/types';
import { flyToCart, type FlySource } from '@/lib/motion';

/** Where an added product's photo flies from (see lib/motion). */
export type Fly = { from: FlySource; image: string };
import type { NavigationGroup, FooterConfig } from '@/lib/settings';
import { roundIqd } from '@/lib/iraq';
import { Check, X, AlertCircle } from 'lucide-react';

export type Region = { name: string; currency: string; rate: number; locale: string };
export type PublicSettings = { storeName: string; tagline: string; logoUrl: string; logoAlt: string; faviconUrl: string; metaTitle: string; metaDescription: string; announcement: string; announcementHref: string; supportEmail: string; supportPhone: string; whatsapp: string; instagram: string; youtube: string; facebook: string; address: string; footerTagline: string; copyrightText: string; exchangeRate: number; freeShippingThreshold: number; codFee: number; codEnabled: boolean; checkoutNote: string; lowStockThreshold?: number; homeHeadline: string; homeHeadlineAr?: string; homeSubheadline: string; homeSubheadlineAr?: string; homeValues: { title: string; text: string; titleAr?: string; textAr?: string }[]; navigation: NavigationGroup[]; footer: FooterConfig };
export const baseRegions: Region[] = [
  { name: 'Iraq', currency: 'IQD', rate: 1320, locale: 'en-IQ' },
  { name: 'United States', currency: 'USD', rate: 1, locale: 'en-US' },
];
type Store = {
  cart: CartLine[]; loaded: boolean; busy: boolean; cartOpen: boolean; setCartOpen: (open: boolean) => void;
  addToCart: (variantId: number, quantity?: number, preview?: Omit<CartLine, 'id' | 'quantity' | 'price'>, fly?: Fly) => Promise<boolean>; addBundleToCart: (bundleId: number, quantity?: number, selection?: Record<string, number>) => Promise<boolean>;
  updateQuantity: (id: number, quantity: number) => Promise<void>; refreshCart: () => Promise<void>;
  count: number; subtotal: number; region: Region; regions: Region[]; setRegion: (region: Region) => void;
  money: (price: number) => string; moneyIqd: (priceIqd: number) => string; notify: (message: string, error?: boolean) => void; settings: PublicSettings; freeShippingUsd: number;
};
const Context = createContext<Store | null>(null);
const REGION_KEY = 'bellroy-region';
export function StoreProvider({ children, settings }: { children: ReactNode; settings: PublicSettings }) {
  const { language } = useLanguage();
  const regions = useMemo(() => baseRegions.map(region => region.currency === 'IQD' ? { ...region, rate: settings.exchangeRate } : region), [settings.exchangeRate]);
  const [cart, setCart] = useState<CartLine[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [cartOpen, setCartOpen] = useState(false);
  const [inFlight, setInFlight] = useState(0);
  const [frozenCount, setFrozenCount] = useState(0);
  const [toast, setToast] = useState<{ message: string; error: boolean } | null>(null);
  // Storage key kept from the original template so returning visitors keep their region.
  const regionName = useLocalStorageValue(REGION_KEY);
  const region = regions.find(item => item.name === regionName) ?? regions[0];
  const notify = useCallback((message: string, error = false) => setToast({ message, error }), []);
  const refreshCart = useCallback(() => fetch('/api/cart')
    .then(response => response.ok ? response.json() : null)
    .then(data => { if (data) setCart(data.items); })
    .catch(() => { /* A connection error is shown on the next cart action. */ })
    .finally(() => setLoaded(true)), []);
  useEffect(() => { void refreshCart(); }, [refreshCart]);
  useEffect(() => { if (!toast) return; const timer = setTimeout(() => setToast(null), 4500); return () => clearTimeout(timer); }, [toast]);
  function setRegion(next: Region) { writeLocalStorage(REGION_KEY, next.name); }
  /**
   * Adds to the bag immediately: the line appears and the bag opens straight away (when a preview
   * is given), then the server confirms. If the server refuses, the bag is put back and the reason shown.
   */
  async function addToCart(variantId: number, quantity = 1, preview?: Omit<CartLine, 'id' | 'quantity' | 'price'>, fly?: Fly) {
    const before = cart;
    // With a photo to fly, the product travels to the bag icon instead of the bag opening; the
    // counter only goes up when it lands.
    let flying = false;
    if (fly) {
      const image = fly.image;
      flying = !window.matchMedia('(prefers-reduced-motion: reduce)').matches && !!document.querySelector('.bag-trigger');
      if (flying) {
        const shown = cart.reduce((sum, item) => sum + item.quantity, 0);
        setFrozenCount(c => (inFlight > 0 ? c : shown));
        setInFlight(n => n + quantity);
        void flyToCart(fly.from, image, () => setInFlight(n => Math.max(0, n - quantity))).then(landed => { if (!landed) { setInFlight(n => Math.max(0, n - quantity)); setCartOpen(true); } });
      }
    }
    if (preview) {
      const existing = cart.find(item => item.variantId === variantId && !item.bundle);
      setCart(existing ? cart.map(item => item === existing ? { ...item, quantity: Math.min(10, item.quantity + quantity) } : item) : [...cart, { ...preview, id: -1e9 - variantId, quantity, price: preview.salePriceIqd / settings.exchangeRate }]);
      if (!flying) setCartOpen(true);
      track.addToCart({ id: preview.productId, name: preview.name, variant: preview.color, price: preview.salePriceIqd, quantity });
    } else setBusy(true);
    try {
      const response = await fetch('/api/cart', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ variantId, quantity }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Something went wrong. Please try again.');
      setCart(data.items);
      if (!preview) {
        if (!flying) setCartOpen(true);
        const line = (data.items as CartLine[]).find(item => item.variantId === variantId);
        if (line) track.addToCart({ id: line.productId, name: line.name, variant: line.color, price: line.salePriceIqd, quantity });
      }
      return true;
    } catch (error) { if (preview) setCart(before); notify(error instanceof Error ? error.message : 'Please check your connection.', true); return false; }
    finally { if (!preview) setBusy(false); }
  }
  async function addBundleToCart(bundleId: number, quantity = 1, selection?: Record<string, number>) {
    if (busy) return false;
    setBusy(true);
    try {
      const response = await fetch('/api/cart', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ bundleId, quantity, selection }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Something went wrong. Please try again.');
      setCart(data.items); setCartOpen(true);
      const line = (data.items as CartLine[]).find(item => item.bundle?.id === bundleId);
      if (line) track.addToCart({ id: line.productId, name: line.name, price: line.salePriceIqd, quantity });
      return true;
    } catch (error) { notify(error instanceof Error ? error.message : 'Please check your connection.', true); return false; }
    finally { setBusy(false); }
  }
  async function updateQuantity(id: number, quantity: number) {
    // Optimistic: the quantity (or removal) shows at once; the server's answer then replaces it,
    // and a failure puts the bag back the way it was.
    const before = cart;
    setCart(quantity > 0 ? cart.map(item => item.id === id ? { ...item, quantity } : item) : cart.filter(item => item.id !== id));
    setBusy(true);
    try {
      const response = await fetch('/api/cart', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, quantity }) });
      const data = await response.json(); if (!response.ok) throw new Error(data.error);
      setCart(data.items);
    } catch (error) { setCart(before); notify(error instanceof Error ? error.message : 'Please check your connection.', true); }
    finally { setBusy(false); }
  }
  // While a product is flying to the bag, the counter keeps its old number until it lands.
  const count = inFlight > 0 ? frozenCount : cart.reduce((sum, item) => sum + item.quantity, 0);
  const subtotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const fmtIqd = useCallback((n: number) => language === 'ar' ? `${groupInt(n)} د.ع` : numberFormat('en-IQ', { style: 'currency', currency: 'IQD', maximumFractionDigits: 0 }).format(n), [language]);
  function money(price: number) {
    if (region.currency === 'IQD') return fmtIqd(roundIqd(price * region.rate));
    return numberFormat(region.locale, { style: 'currency', currency: region.currency, maximumFractionDigits: 0 }).format(Math.round(price * region.rate));
  }
  const moneyIqd = useCallback((priceIqd: number) => { if (region.currency === 'IQD') return fmtIqd(Math.round(priceIqd)); return numberFormat(region.locale, { style: 'currency', currency: 'USD', maximumFractionDigits: 2 }).format(priceIqd / settings.exchangeRate); }, [region, settings.exchangeRate, fmtIqd]);
  const freeShippingUsd = settings.freeShippingThreshold / settings.exchangeRate;
  return <Context.Provider value={{ cart, loaded, busy, cartOpen, setCartOpen, addToCart, updateQuantity, refreshCart, addBundleToCart, count, subtotal, region, regions, setRegion, money, moneyIqd, notify, settings, freeShippingUsd }}>
    {children}
    {toast && <div className={`toast ${toast.error ? 'toast-error' : ''}`} role="status">{toast.error ? <AlertCircle size={19} /> : <Check size={19} />}<span>{toast.message}</span><button aria-label="Dismiss notification" onClick={() => setToast(null)}><X size={17} /></button></div>}
  </Context.Provider>;
}
export function useStore() { const context = useContext(Context); if (!context) throw new Error('StoreProvider is missing'); return context; }
