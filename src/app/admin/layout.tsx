import type { ReactNode } from 'react';
// Admin styles load only under /admin, so the storefront doesn't download or parse them.
// Order matters: it is the order these files had in the root layout.
import '../admin.css';
import '../admin-dashboard.css';
import '../admin-theme.css';
import '../admin-typography.css';
import '../admin-apple.css';

export default function AdminRootLayout({ children }: { children: ReactNode }) {
  return children;
}
