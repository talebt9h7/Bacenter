'use client';
import Link from 'next/link';
import { mediaSrc } from '@/lib/types';
import { useState } from 'react';
import { ArrowRight, Check, Globe2, Camera as Instagram, LoaderCircle, MapPin, Star, CirclePlay as Youtube } from 'lucide-react';
import { useStore } from './store-provider';
import { useLanguage } from './language-provider';
import { storeT } from '@/lib/i18n';


/** The UR monogram (kept under the old name so existing imports keep working). */
export function OwlMark({ size = 30 }: { size?: number }) {
  return <span className="ur-mark" aria-hidden="true" style={{ fontSize: size * 0.8, width: size * 1.3, height: size }}>UR</span>;
}
export function Newsletter({ id = 'newsletter-email' }: { id?: string }) {
  const { settings } = useStore();
  const { language } = useLanguage();
  const t = (label: string) => storeT(label, language);
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('');
  if (!settings.footer.newsletter.active) return null;
  async function submit(event: React.FormEvent) { event.preventDefault(); setStatus('loading'); try { const response = await fetch('/api/newsletter', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email }) }); const data = await response.json(); if (!response.ok) throw new Error(data.error); setStatus('success'); setMessage(data.message); } catch (error) { setStatus('error'); setMessage(error instanceof Error ? error.message : 'Please try again in a moment.'); } }
  const n = settings.footer.newsletter;
  return <section className="newsletter-section"><div className="newsletter-inner"><div className="newsletter-copy"><span className="eyebrow">{language === 'ar' ? (n.eyebrowAr || n.eyebrow) : n.eyebrow}</span><h2>{language === 'ar' ? (n.titleAr || n.title) : n.title}</h2><p>{language === 'ar' ? (n.descriptionAr || n.description) : n.description}</p>{status === 'success' ? <div className="newsletter-success" role="status"><Check size={23} /><div><strong>{language === 'ar' ? 'أهلاً بك معنا.' : 'You’re in good company.'}</strong><span>{message}</span></div></div> : <form onSubmit={submit}><label className="sr-only" htmlFor={id}>{language === 'ar' ? 'بريدك الإلكتروني' : 'Your email address'}</label><div className="newsletter-input"><input id={id} name="email" type="email" required autoComplete="email" placeholder={language === 'ar' ? 'أدخل بريدك الإلكتروني' : 'Enter your email address'} value={email} onChange={event => setEmail(event.target.value)} /><button type="submit" disabled={status === 'loading'} aria-label={t('Subscribe to the newsletter')}>{status === 'loading' ? <LoaderCircle className="spin" size={20} /> : <ArrowRight size={22} />}</button></div>{status === 'error' && <p className="form-error" role="alert">{message}</p>}<small>{t('By signing up, you agree to our')} <Link href="/info/privacy">{t('privacy policy')}</Link>. {t('You can unsubscribe at any time.')}</small></form>}</div>{n.image && <div className="newsletter-art"><img src={mediaSrc(n.image, 960)} alt={settings.storeName} loading="lazy" /></div>}</div></section>;
}
export function Footer() {
  const { region, settings } = useStore();
  const { language } = useLanguage();
  const t = (label: string) => storeT(label, language);
  const footer = settings.footer;
  const iconFor = (icon: string) => icon === 'pin' ? <MapPin size={24} strokeWidth={1.2} /> : icon === 'globe' ? <Globe2 size={24} strokeWidth={1.2} /> : icon === 'star' ? <Star size={25} strokeWidth={1.2} /> : <span className="ur-mark" style={{ fontSize: 18 }}>UR</span>;
  return <>
    <section className="trust-strip" aria-label={t('Store benefits')}>{[...footer.trustItems].filter(x => x.active).sort((a,b)=>a.sortOrder-b.sortOrder).map((item,i)=><div key={`${item.text}-${i}`}>{iconFor(item.icon)}<span>{language === 'ar' ? (item.textAr || item.text) : item.text}</span></div>)}</section>
    <Newsletter />
    <footer className="site-footer"><div className="footer-main"><div className="footer-brand"><Link href="/" aria-label={language === 'ar' ? `${settings.storeName} - الرئيسية` : `${settings.storeName} home`}><img src={settings.logoUrl || "/images/UR-logo.svg"} alt={settings.logoAlt || settings.storeName} width="104" height="61" /></Link><p>{settings.footerTagline.split("\n").map((line, index) => <span key={index}>{index > 0 && <br />}{line}</span>)}</p><div className="social-links"><a href={settings.instagram || "#"} target="_blank" rel="noreferrer" aria-label="Instagram"><Instagram size={20} strokeWidth={1.4} /></a><a href={settings.youtube || "#"} target="_blank" rel="noreferrer" aria-label="YouTube"><Youtube size={22} strokeWidth={1.4} /></a><a href={settings.facebook || "#"} target="_blank" rel="noreferrer" aria-label="Facebook"><span className="facebook-icon">f</span></a></div></div>{footer.groups.map((group, groupIndex) => <div className="footer-link-group" key={`${group.title}-${groupIndex}`}><h3>{language === 'ar' ? (group.titleAr || t(group.title)) : group.title}</h3>{group.links.map((link, linkIndex) => <Link href={link.href} key={`${groupIndex}-${link.label}-${link.href}-${linkIndex}`}>{language === 'ar' ? (link.labelAr || t(link.label)) : link.label}</Link>)}</div>)}</div><div className="footer-bottom"><span>© {new Date().getFullYear()} {settings.storeName}. {settings.copyrightText}</span><span>{t('Got a question?')} <a href={`tel:${settings.supportPhone}`}>{settings.supportPhone}</a> · <a href={`https://wa.me/${settings.whatsapp}`} target="_blank" rel="noreferrer">{language === 'ar' ? 'واتساب' : 'WhatsApp'}</a> · <Link href="/info/contact">{t('Contact')}</Link></span><span><Globe2 size={13} /> {region.name} · {region.currency}</span></div>{footer.demoDisclaimer && <div className="demo-disclaimer">{language === 'ar' ? (footer.demoDisclaimerAr || footer.demoDisclaimer) : footer.demoDisclaimer}</div>}</footer>
  </>;
}
