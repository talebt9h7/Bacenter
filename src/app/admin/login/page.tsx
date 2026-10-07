import { redirect } from 'next/navigation';
import { isAdmin, usingDefaultPassword, DEFAULT_ADMIN_PASSWORD } from '@/lib/admin-auth';
import { LoginForm } from '@/components/admin/login-form';

export const metadata = { title: 'Admin sign in' };
export const dynamic = 'force-dynamic';
export default async function AdminLoginPage() {
  if (await isAdmin()) redirect('/admin');
  return <LoginForm hint={(await usingDefaultPassword()) ? DEFAULT_ADMIN_PASSWORD : null} />;
}
