'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState } from 'react';
import type { AdminActor, AdminSection } from '@/lib/admin-auth';
import { useLanguage } from '@/components/language-provider';
import { adminT, type AppLanguage } from '@/lib/i18n';
import { Boxes, ExternalLink, FileText, Images, LayoutDashboard, LogOut, Menu, MessageSquare, Package, Settings, ShoppingCart, Tag, Truck, Users, X, BarChart3, CircleDollarSign, UserCog, ShieldCheck, PlayCircle, TrendingUp, WalletCards, MapPin } from 'lucide-react';

const groups = [
  { title: 'Overview', links: [{ href: '/admin', label: 'Dashboard', icon: LayoutDashboard, exact: true }, { href: '/admin/reports', label: 'Reports', icon: BarChart3 }] },
  { title: 'Sales', links: [{ href: '/admin/orders', label: 'Orders', icon: ShoppingCart }, { href: '/admin/customers', label: 'Customers', icon: Users }, { href: '/admin/coupons', label: 'Coupons', icon: Tag }] },
  { title: 'Catalog', links: [{ href: '/admin/products', label: 'Products', icon: Package }, { href: '/admin/categories', label: 'Categories', icon: Tag }, { href: '/admin/collections', label: 'Collections', icon: Images }, { href: '/admin/inventory', label: 'Inventory', icon: Boxes }, { href: '/admin/purchases', label: 'Purchases & Suppliers', icon: ShoppingCart }] },
  { title: 'Storefront', links: [{ href: '/admin/homepage', label: 'Homepage', icon: LayoutDashboard }, { href: '/admin/sections', label: 'Sections', icon: Images }, { href: '/admin/media', label: 'Media Library', icon: Images }, { href: '/admin/navigation', label: 'Header & Navigation', icon: Menu }, { href: '/admin/footer', label: 'Footer', icon: FileText }, { href: '/admin/banners', label: 'Banners', icon: Images }, { href: '/admin/content', label: 'Content', icon: FileText }, { href: '/admin/videos', label: 'Video Stories', icon: PlayCircle }, { href: '/admin/messages', label: 'Inbox', icon: MessageSquare }, { href: '/admin/stores', label: 'Stores & stockists', icon: MapPin }] },
  { title: 'Finance', links: [{ href: '/admin/revenue', label: 'Revenue', icon: CircleDollarSign }, { href: '/admin/profit', label: 'Profit', icon: TrendingUp }, { href: '/admin/finance', label: 'Finance & Expenses', icon: WalletCards }] },
  { title: 'Configuration', links: [{ href: '/admin/shipping', label: 'Delivery · Iraq', icon: Truck }, { href: '/admin/settings', label: 'Settings', icon: Settings }, { href: '/admin/team', label: 'Team & Permissions', icon: UserCog }, { href: '/admin/activity', label: 'Activity Log', icon: FileText }, { href: '/admin/seo', label: 'SEO', icon: ShieldCheck }, { href: '/admin/redirects', label: 'URL Redirects', icon: ExternalLink }, { href: '/admin/backup', label: 'Backup & Restore', icon: ShieldCheck }] },
];
const pathSections: Record<string, AdminSection> = {
  '/admin/reports':'overview','/admin/orders':'sales','/admin/customers':'sales','/admin/coupons':'sales',
  '/admin/products':'catalog','/admin/categories':'catalog','/admin/collections':'catalog','/admin/inventory':'catalog','/admin/purchases':'catalog',
  '/admin/homepage':'storefront','/admin/sections':'storefront','/admin/media':'storefront','/admin/navigation':'storefront','/admin/footer':'storefront','/admin/banners':'storefront','/admin/content':'storefront','/admin/videos':'storefront','/admin/messages':'storefront','/admin/stores':'storefront',
  '/admin/revenue':'finance','/admin/profit':'finance','/admin/finance':'finance','/admin/shipping':'configuration','/admin/settings':'configuration','/admin/team':'team','/admin/activity':'configuration','/admin/seo':'configuration','/admin/redirects':'configuration','/admin/backup':'configuration',
};
function canViewPath(actor: AdminActor, href: string) {
  if (href === '/admin/backup') return actor.type === 'owner';
  if (actor.type === 'owner') return true;
  const section = pathSections[href];
  return !section || !!actor.permissions[section]?.view;
}
export function AdminNav({ actor }: { actor: AdminActor }) {
  const { language, setLanguage } = useLanguage();
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  async function logout() { await fetch('/api/admin/login', { method: 'DELETE' }); router.replace('/admin/login'); router.refresh(); }
  const tr = (label: string) => adminT(label as keyof typeof import('@/lib/i18n').adminTranslations, language as AppLanguage);
  return <>
    <header className="admin-topbar"><button className="admin-icon-btn" aria-label={open ? 'Close menu' : 'Open menu'} onClick={() => setOpen(!open)}>{open ? <X size={22} /> : <Menu size={22} />}</button><Link href="/admin" className="admin-brand"><img src="/images/bellroy-logo.svg" alt="Bellroy" width="64" height="38" /><span>Admin</span></Link><div className="admin-language-switcher" role="group" aria-label="Language"><button type="button" className={language === 'en' ? 'active' : ''} onClick={() => setLanguage('en')}>EN</button><button type="button" className={language === 'ar' ? 'active' : ''} onClick={() => setLanguage('ar')}>ع</button></div><button className="admin-icon-btn" aria-label="Sign out" onClick={logout}><LogOut size={19} /></button></header>
    <aside className={`admin-sidebar ${open ? 'open' : ''}`}><Link href="/admin" className="admin-brand"><img src="/images/bellroy-logo.svg" alt="Bellroy" width="74" height="44" /><span>Admin</span></Link><div className="admin-language-panel"><div className="admin-language-label">Language / اللغة</div><div className="admin-language-switcher sidebar-language-switcher" role="group" aria-label="Language"><button type="button" className={language === 'en' ? 'active' : ''} onClick={() => setLanguage('en')}>English</button><button type="button" className={language === 'ar' ? 'active' : ''} onClick={() => setLanguage('ar')}>العربية</button></div></div><nav aria-label="Admin navigation">{groups.filter(group => group.links.some(link => canViewPath(actor, link.href))).map(group => <div key={group.title} className="admin-nav-group"><span>{tr(group.title)}</span>{group.links.filter(link => canViewPath(actor, link.href)).map(link => { const active = 'exact' in link && link.exact ? pathname === link.href : pathname.startsWith(link.href); return <Link key={link.href} href={link.href} className={active ? 'active' : ''} onClick={() => setOpen(false)}><link.icon size={17} strokeWidth={1.6} />{tr(link.label)}</Link>; })}</div>)}</nav><div className="admin-sidebar-bottom"><div className="admin-language-switcher sidebar-language-switcher" role="group" aria-label="Language"><button type="button" className={language === 'en' ? 'active' : ''} onClick={() => setLanguage('en')}>English</button><button type="button" className={language === 'ar' ? 'active' : ''} onClick={() => setLanguage('ar')}>العربية</button></div><a href="/" target="_blank" rel="noreferrer"><ExternalLink size={16} /> {tr('View storefront')}</a><button onClick={logout}><LogOut size={16} /> {tr('Sign out')}</button></div></aside>
    {open && <div className="admin-sidebar-backdrop" onClick={() => setOpen(false)} />}
  </>;
}
