import { getActiveZones, getPublicSettings } from '@/lib/settings';
import { gatewayReady, getPaymentSettings } from '@/lib/payments/config';

/** What the checkout needs up front: delivery zones, public store settings and whether online payment is on. */
export async function checkoutConfig() {
  const [zones, settings, pay] = await Promise.all([getActiveZones(), getPublicSettings(), getPaymentSettings()]);
  return { gateway: { enabled: gatewayReady(pay), provider: pay.provider }, zones: zones.map(zone => ({ code: zone.code, nameEn: zone.nameEn, nameAr: zone.nameAr, rate: zone.rate, minDays: zone.minDays, maxDays: zone.maxDays })), settings };
}
