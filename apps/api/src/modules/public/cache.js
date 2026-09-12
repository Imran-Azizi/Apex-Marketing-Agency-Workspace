import { createTtlCache } from '../../utils/ttlCache.js';

/** Shared in-process cache for public marketing GETs. */
export const publicOriginCache = createTtlCache();

/**
 * Drop all cached public portfolio list/detail/category payloads so the next
 * request hits the database immediately after a manager publish/edit.
 */
export function invalidatePublicPortfolioCache() {
  publicOriginCache.invalidate('portfolio-categories');
  publicOriginCache.invalidatePrefix('portfolio:');
  publicOriginCache.invalidatePrefix('portfolio-slug:');
}

/** Drop cached public services list after manager create/edit/publish/delete. */
export function invalidatePublicServicesCache() {
  publicOriginCache.invalidate('services');
}

/** Drop cached public customers showcase after manager create/edit/reorder/delete. */
export function invalidatePublicCustomersCache() {
  publicOriginCache.invalidate('customers');
}

/** Drop cached public hero slides after manager create/edit/reorder/delete. */
export function invalidatePublicHeroCache() {
  publicOriginCache.invalidate('hero');
}

/** Drop cached public section descriptions after manager settings save. */
export function invalidatePublicSiteCopyCache() {
  publicOriginCache.invalidate('site-copy');
}
