import { invalidatePublicLandingPagesCache } from "../public/cache.js";
import { notifyWebLandingPagesRevalidate } from "../../services/web-revalidate.js";

export async function afterPublicLandingPagesMutation({ slug, previousSlug } = {}) {
  invalidatePublicLandingPagesCache();
  void notifyWebLandingPagesRevalidate({ slug, previousSlug });
}
