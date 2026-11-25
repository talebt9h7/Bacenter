import { Suspense } from 'react';
import { MyOrders } from '@/components/my-orders';
import '../../my-orders.css';

export const metadata = { title: 'طلباتي', robots: { index: false, follow: false } };

export default function MyOrdersPage() {
  return <Suspense fallback={null}><MyOrders /></Suspense>;
}
