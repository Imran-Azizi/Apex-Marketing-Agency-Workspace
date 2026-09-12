import { invalidatePublicCustomersCache } from '../public/cache.js';
import { notifyWebCustomersRevalidate } from '../../services/web-revalidate.js';

export async function afterPublicCustomersMutation() {
  invalidatePublicCustomersCache();
  void notifyWebCustomersRevalidate();
}
