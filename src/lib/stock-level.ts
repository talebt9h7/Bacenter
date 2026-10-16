/**
 * One rule for "low stock" everywhere in the admin: it is judged on what can still be sold
 * (on hand minus units reserved by pending orders), against the threshold in Settings.
 */
export type StockLevel = 'out' | 'low' | 'ok';
export const availableUnits = (onHand: number, reserved = 0) => Math.max(0, onHand - reserved);
export function stockLevel(available: number, threshold: number): StockLevel {
  if (available <= 0) return 'out';
  if (available <= threshold) return 'low';
  return 'ok';
}
