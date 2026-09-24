import { env } from '../config/env.js';

/**
 * Ask the Next.js app to revalidate public marketing tags/paths after a write.
 * Fire-and-forget; never blocks or fails the mutating request.
 */
async function notifyWebRevalidate({ tags = [], paths = [] } = {}) {
  const secret = env.webRevalidateSecret;
  if (!secret || !env.webUrl) return { skipped: true };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 4_000);
  try {
    const res = await fetch(`${env.webUrl}/api/revalidate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-revalidate-secret': secret,
      },
      body: JSON.stringify({
        tags: [...new Set(tags.filter(Boolean))],
        paths: [...new Set(paths.filter(Boolean))],
      }),
      signal: controller.signal,
    });
    if (!res.ok) {
      console.warn(
        '[web-revalidate] failed:',
        res.status,
        await res.text().catch(() => ''),
      );
      return { ok: false, status: res.status };
    }
    return { ok: true };
  } catch (err) {
    console.warn(
      '[web-revalidate] error:',
      err?.message || err,
    );
    return { ok: false, error: String(err?.message || err) };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Ask the Next.js app to revalidate public portfolio pages/tags after a write.
 */
export async function notifyWebPortfolioRevalidate({
  slug = null,
  paths = [],
} = {}) {
  const targetPaths = new Set(['/', ...paths.filter(Boolean)]);
  if (slug) {
    targetPaths.add(`/portfolio/${slug}`);
    targetPaths.add(`/نمونه-کارها/${slug}`);
  }

  return notifyWebRevalidate({
    tags: ['public-portfolio'],
    paths: [...targetPaths],
  });
}

/** Revalidate public services section + home after service catalog writes. */
export async function notifyWebServicesRevalidate({ paths = [] } = {}) {
  return notifyWebRevalidate({
    tags: ['public-services'],
    paths: ['/', '/services', ...paths.filter(Boolean)],
  });
}

/** Revalidate public customers section + home after showcase writes. */
export async function notifyWebCustomersRevalidate({ paths = [] } = {}) {
  return notifyWebRevalidate({
    tags: ['public-customers'],
    paths: ['/', '/customers', ...paths.filter(Boolean)],
  });
}

/** Revalidate public hero slideshow after manager slide writes. */
export async function notifyWebHeroRevalidate({ paths = [] } = {}) {
  return notifyWebRevalidate({
    tags: ['public-hero'],
    paths: ['/', ...paths.filter(Boolean)],
  });
}

/** Revalidate a published landing page after publish/unpublish/delete. */
export async function notifyWebLandingPagesRevalidate({
  slug = null,
  previousSlug = null,
  paths = [],
} = {}) {
  const targetPaths = new Set(paths.filter(Boolean));
  if (slug) targetPaths.add(`/${slug}`);
  if (previousSlug && previousSlug !== slug) targetPaths.add(`/${previousSlug}`);
  return notifyWebRevalidate({
    tags: ['public-landing-pages'],
    paths: [...targetPaths],
  });
}

/** Revalidate public section descriptions after settings writes. */
export async function notifyWebSiteCopyRevalidate({ paths = [] } = {}) {
  return notifyWebRevalidate({
    tags: ['public-site-copy'],
    paths: ['/', ...paths.filter(Boolean)],
  });
}
