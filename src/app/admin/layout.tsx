import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
// Admin styles load only under /admin, so the storefront doesn't download or parse them.
// Order matters: it is the order these files had in the root layout.
import '../admin.css';
import '../admin-dashboard.css';
import '../admin-theme.css';
import '../admin-typography.css';
import '../admin-apple.css';

// The admin can be added to a phone's home screen and opens full screen like an app
// (public/admin.webmanifest, scoped to /admin; the storefront is not affected).
export const metadata: Metadata = {
  manifest: '/admin.webmanifest',
  appleWebApp: { capable: true, title: 'أور أدمن', statusBarStyle: 'default' },
  icons: { icon: '/admin-icon/192', apple: [{ url: '/admin-icon/180', sizes: '180x180' }] },
  formatDetection: { telephone: false },
};
export const viewport: Viewport = { themeColor: '#f6f1ea', viewportFit: 'cover' };

export default function AdminRootLayout({ children }: { children: ReactNode }) {
  return children;
}
