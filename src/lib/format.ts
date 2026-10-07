export const iqd = (value: number) => { const n = Number(value); return new Intl.NumberFormat('en-IQ', { style: 'currency', currency: 'IQD', maximumFractionDigits: 0 }).format(Number.isFinite(n) ? n : 0); };
export const money = (amount: number, currency: string) => currency === 'IQD' ? iqd(amount) : new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(amount / 100);
export const when = (value: string | Date) => new Date(value).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' });
