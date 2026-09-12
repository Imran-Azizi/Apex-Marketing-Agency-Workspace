import { invalidatePublicPortfolioCache } from '../public/cache.js';
import { notifyWebPortfolioRevalidate } from '../../services/web-revalidate.js';

/**
 * After any portfolio mutation that affects the public website:
 * drop API TTL cache and ask Next.js to revalidate portfolio tags/paths.
 */
export async function afterPublicPortfolioMutation({ slug = null } = {}) {
  invalidatePublicPortfolioCache();
  void notifyWebPortfolioRevalidate({ slug });
}
