'use client';

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import type { CartLine } from '@/lib/types';
import type { NavigationGroup, FooterConfig } from '@/lib/settings';
import { roundIqd } from '@/lib/iraq';
import { Check, X, AlertCircle } from 'lucide-react';

export type Region = { name: string; currency: string; rate: number; locale: string };
export type PublicSettings = { storeName: string; tagline: string; logoUrl: string; logoAlt: string; faviconUrl: string; metaTitle: string; metaDescription: string; announcement: string; announcementHref: string; supportEmail: string; supportPhone: string; whatsapp: string; instagram: string; youtube: string; facebook: string; address: string; footerTagline: string; copyrightText: string; exchangeRate: number; freeShippingThreshold: number; codFee: number; codEnabled: boolean; checkoutNote: string; homeHeadline: string; homeSubheadline: string; homeValues: { title: string; text: string; titleAr?: string; textAr?: string }[]; navigation: NavigationGroup[]; footer: FooterConfig };
export const baseRegions: Region[] = [
  { name: 'Iraq', currency: 'IQD', rate: 1320, locale: 'en-IQ' },
  { name: 'United States', currency: 'USD', rate: 1, locale: 'en-US' },
];
type Store = {
  cart: CartLine[]; loaded: boolean; busy: boolean; cartOpen: boolean; setCartOpen: (open: boolean) => void;
  addToCart: (variantId: number, quantity?: number) => Promise<boolean>;
  updateQuantity: (id: number, quantity: number) => Promise<void>; refreshCart: () => Promise<void>;
  count: number; subtotal: number; region: Region; regions: Region[]; setRegion: (region: Region) => void;
  money: (price: number) => string; moneyIqd: (priceIqd: number) => string; notify: (message: string, error?: boolean) => void; settings: PublicSettings; freeShippingUsd: number;
};
const Context = createContext<Store | null>(null);
export function StoreProvider({ children, settings }: { children: ReactNode; settings: PublicSettings }) {
  const regions = baseRegions.map(region => region.currency === 'IQD' ? { ...region, rate: settings.exchangeRate } : region);
  const [cart, setCart] = useState<CartLine[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [cartOpen, setCartOpen] = useState(false);
  const [regionName, setRegionName] = useState(regions[0].name);
  const [toast, setToast] = useState<{ message: string; error: boolean } | null>(null);
  const region = regions.find(item => item.name === regionName) ?? regions[0];
  const notify = useCallback((message: string, error = false) => setToast({ message, error }), []);
  const refreshCart = useCallback(async () => {
    try { const response = await fetch('/api/cart'); if (response.ok) { const data = await response.json(); setCart(data.items); } }
    catch { /* A connection error is shown on the next cart action. */ }
    finally { setLoaded(true); }
  }, []);
  useEffect(() => {
    void refreshCart();
    try { const saved = localStorage.getItem('bellroy-region'); if (saved && baseRegions.some(r => r.name === saved)) setRegionName(saved); } catch {}
  }, [refreshCart]);
  useEffect(() => { if (!toast) return; const timer = setTimeout(() => setToast(null), 4500); return () => clearTimeout(timer); }, [toast]);
  function setRegion(next: Region) { setRegionName(next.name); try { localStorage.setItem('bellroy-region', next.name); } catch {} }
  async function addToCart(variantId: number, quantity = 1) {
    if (busy) return false;
    setBusy(true);
    try {
      const response = await fetch('/api/cart', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ variantId, quantity }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Something went wrong. Please try again.');
      setCart(data.items); setCartOpen(true); return true;
    } catch (error) { notify(error instanceof Error ? error.message : 'Please check your connection.', true); return false; }
    finally { setBusy(false); }
  }
  async function updateQuantity(id: number, quantity: number) {
    setBusy(true);
    try {
      const response = await fetch('/api/cart', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, quantity }) });
      const data = await response.json(); if (!response.ok) throw new Error(data.error);
      setCart(data.items);
    } catch (error) { notify(error instanceof Error ? error.message : 'Please check your connection.', true); }
    finally { setBusy(false); }
  }
  const count = cart.reduce((sum, item) => sum + item.quantity, 0);
  const subtotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  function money(price: number) {
    if (region.currency === 'IQD') return new Intl.NumberFormat('en-IQ', { style: 'currency', currency: 'IQD', maximumFractionDigits: 0 }).format(roundIqd(price * region.rate));
    return new Intl.NumberFormat(region.locale, { style: 'currency', currency: region.currency, maximumFractionDigits: 0 }).format(Math.round(price * region.rate));
  }
  const moneyIqd = useCallback((priceIqd: number) => { if (region.currency === 'IQD') return new Intl.NumberFormat('en-IQ', { style: 'currency', currency: 'IQD', maximumFractionDigits: 0 }).format(Math.round(priceIqd)); return new Intl.NumberFormat(region.locale, { style: 'currency', currency: 'USD', maximumFractionDigits: 2 }).format(priceIqd / settings.exchangeRate); }, [region, settings.exchangeRate]);
  const freeShippingUsd = settings.freeShippingThreshold / settings.exchangeRate;
  return <Context.Provider value={{ cart, loaded, busy, cartOpen, setCartOpen, addToCart, updateQuantity, refreshCart, count, subtotal, region, regions, setRegion, money, moneyIqd, notify, settings, freeShippingUsd }}>
    {children}
    {toast && <div className={`toast ${toast.error ? 'toast-error' : ''}`} role="status">{toast.error ? <AlertCircle size={19} /> : <Check size={19} />}<span>{toast.message}</span><button aria-label="Dismiss notification" onClick={() => setToast(null)}><X size={17} /></button></div>}
  </Context.Provider>;
}
export function useStore() { const context = useContext(Context); if (!context) throw new Error('StoreProvider is missing'); return context; }
