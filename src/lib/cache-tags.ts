import { revalidateTag } from 'next/cache';

/**
 * Storefront reads (products, stock, settings) are cached across requests so a
 * product page does not need several database round trips on every visit.
 * Every write that changes those reads must call the matching invalidate helper.
 * The cache also expires on its own (see the revalidate values where the data is
 * read), so a missed invalidation can only show data that is a minute or so old.
 */
export const CATALOG_TAG = 'catalog';
export const SETTINGS_TAG = 'settings';

function expire(tag: string) {
  try {
    revalidateTag(tag, { expire: 0 });
  } catch {
    // Outside a Next.js request (scripts, tests) there is no cache to clear.
  }
}

export function invalidateCatalog() {
  expire(CATALOG_TAG);
}

export function invalidateSettings() {
  expire(SETTINGS_TAG);
}
