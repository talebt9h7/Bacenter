import { notFound } from 'next/navigation';
import { getPaymentByToken, publicPayment } from '@/lib/payments';
import { PayView } from '@/components/pay-view';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Payment', robots: { index: false, follow: false } };

export default async function PayPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const payment = await getPaymentByToken(token);
  if (!payment) notFound();
  return <PayView initial={await publicPayment(payment)} />;
}
