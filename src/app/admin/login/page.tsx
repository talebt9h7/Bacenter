import { redirect } from 'next/navigation';
import { isAdmin } from '@/lib/admin-auth';
import { LoginForm } from '@/components/admin/login-form';
import { getSettings } from '@/lib/settings';

export const metadata = { title: 'Admin sign in' };
export const dynamic = 'force-dynamic';
export default async function AdminLoginPage() {
  if (await isAdmin()) redirect('/admin');
  const settings = await getSettings();
  // The store's own logo (Settings → logo), not the UR letters.
  return <LoginForm logoUrl={settings.logoUrl} logoAlt={settings.logoAlt || settings.storeName} />;
}
