import { redirect } from 'next/navigation';
import { requireAdminSection } from '@/lib/admin-auth';
import { getSettings } from '@/lib/settings';
import { SettingsForm } from '@/components/admin/managers';

export const metadata = { title: 'Settings' };
export default async function AdminSettingsPage() {
  const actor = await requireAdminSection('configuration', 'view');
  if (!actor) redirect('/admin');
  const s = await getSettings();
  return <main className="admin-page"><div className="admin-page-heading"><div><span className="admin-eyebrow">Configuration</span><h1>Settings</h1><p>Store identity, contact details, currency conversion and admin security.</p></div></div><SettingsForm initial={{ storeName: s.storeName, tagline: s.tagline, logoUrl: s.logoUrl, logoAlt: s.logoAlt, faviconUrl: s.faviconUrl, metaTitle: s.metaTitle, metaDescription: s.metaDescription, announcement: s.announcement, announcementHref: s.announcementHref, supportEmail: s.supportEmail, supportPhone: s.supportPhone, whatsapp: s.whatsapp, instagram: s.instagram, youtube: s.youtube, facebook: s.facebook, address: s.address, footerTagline: s.footerTagline, copyrightText: s.copyrightText, exchangeRate: s.exchangeRate, lowStockThreshold: s.lowStockThreshold, orderPrefix: s.orderPrefix, checkoutNote: s.checkoutNote }} /></main>;
}
