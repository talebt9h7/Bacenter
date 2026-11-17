import { Checkout } from '@/components/checkout';
import { checkoutConfig } from '@/lib/checkout-config';

export const metadata = { title: 'Checkout' };
export const dynamic = 'force-dynamic';

/** The checkout opens straight away: zones and settings come with the page instead of a loading screen. */
export default async function CheckoutPage() {
  const config = await checkoutConfig().catch(() => null);
  return <Checkout initialConfig={config ? JSON.parse(JSON.stringify(config)) : null} />;
}
