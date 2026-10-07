import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { requireAdminSection } from '@/lib/admin-auth';
import { desc } from 'drizzle-orm';
import { db } from '@/db';
import { newsletterSubscribers, supportMessages } from '@/db/schema';
import { when } from '@/lib/format';
import { StatusBadge } from '@/components/admin/status-badge';
import { MessageActions } from '@/components/admin/message-actions';
import { LANGUAGE_COOKIE, normalizeLanguage } from '@/lib/i18n';

export const metadata = { title: 'Inbox' };
export default async function AdminMessagesPage() {
  const actor = await requireAdminSection('storefront', 'view');
  if (!actor) redirect('/admin');
  const lang = normalizeLanguage((await cookies()).get(LANGUAGE_COOKIE)?.value);
  const t=(en:string,ar:string)=>lang==='ar'?ar:en;
  const [messages, subscribers] = await Promise.all([db.select().from(supportMessages).orderBy(desc(supportMessages.createdAt)).limit(300), db.select().from(newsletterSubscribers).orderBy(desc(newsletterSubscribers.createdAt)).limit(500)]);
  return <main className="admin-page"><div className="admin-page-heading"><div><span className="admin-eyebrow">{t('Inbox','صندوق الوارد')}</span><h1>{t('Messages & subscribers','الرسائل والمشتركون')}</h1><p>{t('Support enquiries from the contact form and the newsletter list.','استفسارات الدعم من نموذج الاتصال وقائمة النشرة البريدية.')}</p></div></div>
    <section className="admin-card"><div className="admin-card-heading"><h2>{t('Support messages','رسائل الدعم')}</h2><span className="admin-count">{messages.filter(item => item.status === 'open').length} {t('open','مفتوح')}</span></div><div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>{t('Received','تاريخ الاستلام')}</th><th>{t('From','من')}</th><th>{t('Subject','الموضوع')}</th><th>{t('Message','الرسالة')}</th><th>{t('Status','الحالة')}</th><th /></tr></thead><tbody>{messages.map(item => <tr key={item.id}><td><small>{when(item.createdAt)}</small></td><td>{item.name}<br /><small><a href={`mailto:${item.email}`}>{item.email}</a></small></td><td>{item.subject}</td><td className="admin-message-cell">{item.message}</td><td><StatusBadge status={item.status} /></td><td className="num"><MessageActions id={item.id} status={item.status} /></td></tr>)}{!messages.length && <tr><td colSpan={6}><p className="admin-empty">{t('No messages yet.','لا توجد رسائل بعد.')}</p></td></tr>}</tbody></table></div></section>
    <section className="admin-card"><div className="admin-card-heading"><h2>{t('Newsletter subscribers','مشتركو النشرة البريدية')}</h2><span className="admin-count">{subscribers.length}</span></div><div className="admin-subscribers">{subscribers.map(item => <span key={item.id} title={when(item.createdAt)}>{item.email}</span>)}{!subscribers.length && <p className="admin-empty">{t('No subscribers yet.','لا يوجد مشتركون بعد.')}</p>}</div></section></main>;
}
