import { cookies } from 'next/headers';
import { LANGUAGE_COOKIE, normalizeLanguage } from '@/lib/i18n';

type Text = { en: string; ar: string };
/** Bilingual page heading for server-rendered admin pages. */
export async function AdminHeading({ eyebrow, title, description }: { eyebrow: Text; title: Text; description: Text }) {
  const lang = normalizeLanguage((await cookies()).get(LANGUAGE_COOKIE)?.value);
  const pick = (t: Text) => lang === 'ar' ? t.ar : t.en;
  return <div className="admin-page-heading"><div><span className="admin-eyebrow">{pick(eyebrow)}</span><h1>{pick(title)}</h1><p>{pick(description)}</p></div></div>;
}
