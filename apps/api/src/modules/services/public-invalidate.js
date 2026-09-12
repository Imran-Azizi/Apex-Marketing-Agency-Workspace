import { invalidatePublicServicesCache } from '../public/cache.js';
import { notifyWebServicesRevalidate } from '../../services/web-revalidate.js';

/**
 * After any service mutation that affects «خدمات ما»:
 * drop API TTL cache and ask Next.js to revalidate services tags/paths.
 */
export async function afterPublicServicesMutation() {
  invalidatePublicServicesCache();
  void notifyWebServicesRevalidate();
}
