'use client';
import { Activity, AlertTriangle, Bell, Boxes, Calendar, CheckCircle2, Clock, Coins, Database, Eye, EyeOff, FileText, Folder, Image as ImageIcon, Inbox, Layers, Link2, Mail, Map, Menu, Percent, Search, ShieldCheck, Store, Tag, Ticket, Truck, Users, Video, Wallet } from 'lucide-react';
import { Kpi, KpiGrid } from './dash-ui';
import { useLanguage } from '@/components/language-provider';
import type { KpiIcon, KpiSpec } from '@/lib/admin-page-stats';

const ICONS: Record<KpiIcon, typeof Tag> = { tag: Tag, ticket: Ticket, percent: Percent, wallet: Wallet, truck: Truck, users: Users, mail: Mail, inbox: Inbox, boxes: Boxes, layers: Layers, folder: Folder, image: ImageIcon, video: Video, store: Store, link: Link2, map: Map, shield: ShieldCheck, clock: Clock, activity: Activity, database: Database, file: FileText, eye: Eye, eyeoff: EyeOff, alert: AlertTriangle, check: CheckCircle2, menu: Menu, bell: Bell, search: Search, coins: Coins, calendar: Calendar };
const formats = {
  number: (v: number) => new Intl.NumberFormat('en-US').format(Math.round(v)),
  iqd: (v: number) => `${new Intl.NumberFormat('en-US').format(Math.round(v))} IQD`,
  percent: (v: number) => `${Math.round(v)}%`,
  bytes: (v: number) => v >= 1048576 ? `${(v / 1048576).toFixed(1)} MB` : v >= 1024 ? `${Math.round(v / 1024)} KB` : `${Math.round(v)} B`,
};

/** Dashboard-style KPI tiles at the top of an admin page (data from pageStats). */
export function PageKpis({ items }: { items: KpiSpec[] }) {
  const { language } = useLanguage();
  const lang = language === 'ar' ? 'ar' : 'en';
  if (!items.length) return null;
  return <KpiGrid columns={Math.min(items.length, 6) === 6 ? undefined : Math.min(items.length, 5)}>
    {items.map((k, i) => { const Icon = ICONS[k.icon]; return <Kpi key={k.en} lang={lang} delay={i * 50} tone={k.tone} icon={<Icon size={17} />} label={lang === 'ar' ? k.ar : k.en} value={k.value} format={formats[k.format ?? 'number']} note={lang === 'ar' ? k.noteAr : k.noteEn} href={k.href} />; })}
  </KpiGrid>;
}
