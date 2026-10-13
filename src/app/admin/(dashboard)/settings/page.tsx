import { PageKpis } from '@/components/admin/page-kpis';
import { pageStats } from '@/lib/admin-page-stats';
import { AdminHeading } from '@/components/admin/admin-heading';
import { redirect } from 'next/navigation';
import { requireAdminSection } from '@/lib/admin-auth';
import { getSettings } from '@/lib/settings';
import { SettingsForm } from '@/components/admin/managers';

export const metadata = { title: 'Settings' };
export default async function AdminSettingsPage() {
  const actor = await requireAdminSection('configuration', 'view');
  if (!actor) redirect('/admin');
  const s = await getSettings();
  return <main className="admin-page"><AdminHeading eyebrow={{ en: 'Configuration', ar: 'الإعدادات' }} title={{ en: 'Settings', ar: 'الإعدادات العامة' }} description={{ en: 'Store identity, contact details, currency conversion and admin security.', ar: 'هوية المتجر، بيانات التواصل، سعر الصرف، وأمان لوحة الإدارة.' }} /><PageKpis items={await pageStats('settings')} /><SettingsForm initial={{ storeName: s.storeName, tagline: s.tagline, logoUrl: s.logoUrl, logoAlt: s.logoAlt, faviconUrl: s.faviconUrl, metaTitle: s.metaTitle, metaDescription: s.metaDescription, announcement: s.announcement, announcementHref: s.announcementHref, supportEmail: s.supportEmail, supportPhone: s.supportPhone, whatsapp: s.whatsapp, instagram: s.instagram, youtube: s.youtube, facebook: s.facebook, address: s.address, footerTagline: s.footerTagline, copyrightText: s.copyrightText, exchangeRate: s.exchangeRate, lowStockThreshold: s.lowStockThreshold, orderPrefix: s.orderPrefix, checkoutNote: s.checkoutNote }} /></main>;
}
