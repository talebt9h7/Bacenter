// Iraq-only delivery: the 18 governorates with default courier rates in IQD.
export const iraqGovernorates = [
  { code: 'baghdad', nameEn: 'Baghdad', nameAr: 'بغداد', rate: 5000, minDays: 1, maxDays: 2 },
  { code: 'basra', nameEn: 'Basra', nameAr: 'البصرة', rate: 8000, minDays: 2, maxDays: 4 },
  { code: 'nineveh', nameEn: 'Nineveh (Mosul)', nameAr: 'نينوى', rate: 8000, minDays: 2, maxDays: 4 },
  { code: 'erbil', nameEn: 'Erbil', nameAr: 'أربيل', rate: 8000, minDays: 2, maxDays: 4 },
  { code: 'sulaymaniyah', nameEn: 'Sulaymaniyah', nameAr: 'السليمانية', rate: 8000, minDays: 2, maxDays: 4 },
  { code: 'duhok', nameEn: 'Duhok', nameAr: 'دهوك', rate: 8000, minDays: 2, maxDays: 5 },
  { code: 'kirkuk', nameEn: 'Kirkuk', nameAr: 'كركوك', rate: 7000, minDays: 2, maxDays: 4 },
  { code: 'anbar', nameEn: 'Anbar', nameAr: 'الأنبار', rate: 8000, minDays: 2, maxDays: 5 },
  { code: 'babil', nameEn: 'Babil', nameAr: 'بابل', rate: 6000, minDays: 1, maxDays: 3 },
  { code: 'karbala', nameEn: 'Karbala', nameAr: 'كربلاء', rate: 6000, minDays: 1, maxDays: 3 },
  { code: 'najaf', nameEn: 'Najaf', nameAr: 'النجف', rate: 6000, minDays: 1, maxDays: 3 },
  { code: 'qadisiyah', nameEn: 'Al-Qadisiyah (Diwaniyah)', nameAr: 'القادسية', rate: 7000, minDays: 2, maxDays: 4 },
  { code: 'muthanna', nameEn: 'Muthanna (Samawah)', nameAr: 'المثنى', rate: 8000, minDays: 2, maxDays: 4 },
  { code: 'dhi-qar', nameEn: 'Dhi Qar (Nasiriyah)', nameAr: 'ذي قار', rate: 7000, minDays: 2, maxDays: 4 },
  { code: 'maysan', nameEn: 'Maysan (Amarah)', nameAr: 'ميسان', rate: 8000, minDays: 2, maxDays: 4 },
  { code: 'wasit', nameEn: 'Wasit (Kut)', nameAr: 'واسط', rate: 7000, minDays: 2, maxDays: 4 },
  { code: 'diyala', nameEn: 'Diyala', nameAr: 'ديالى', rate: 6000, minDays: 1, maxDays: 3 },
  { code: 'saladin', nameEn: 'Saladin (Tikrit)', nameAr: 'صلاح الدين', rate: 7000, minDays: 2, maxDays: 4 },
];
export const iraqPhonePattern = /^07[3-9]\d{8}$/;
export function normalizeIraqPhone(raw: string) {
  let digits = raw.replace(/[^\d+]/g, '');
  if (digits.startsWith('+964')) digits = '0' + digits.slice(4);
  else if (digits.startsWith('00964')) digits = '0' + digits.slice(5);
  else if (digits.startsWith('964')) digits = '0' + digits.slice(3);
  return digits;
}
export function roundIqd(value: number) { return Math.max(0, Math.round(value / 250) * 250); }
export function formatAmount(amount: number, currency: string) {
  if (currency === 'IQD') return new Intl.NumberFormat('en-IQ', { style: 'currency', currency: 'IQD', maximumFractionDigits: 0 }).format(amount);
  return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(amount / 100);
}
export const orderStatuses = ['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled', 'returned'] as const;
export type OrderStatus = typeof orderStatuses[number];
export const statusLabels: Record<OrderStatus, string> = { pending: 'Pending', confirmed: 'Confirmed', processing: 'Processing', shipped: 'Shipped', delivered: 'Delivered', cancelled: 'Cancelled', returned: 'Returned' };
export const statusTransitions: Record<OrderStatus, OrderStatus[]> = { pending: ['confirmed', 'cancelled'], confirmed: ['processing', 'cancelled'], processing: ['shipped', 'cancelled'], shipped: ['delivered', 'returned'], delivered: ['returned'], cancelled: [], returned: [] };
