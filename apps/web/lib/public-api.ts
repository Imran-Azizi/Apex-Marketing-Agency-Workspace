/**
 * Server-only fetch helpers for public marketing APIs.
 * Uses Next.js fetch cache so layout + page requests dedupe in one render.
 *
 * Always bounded by a short timeout so a slow/hung API cannot stall HTML
 * streaming on weak networks (looks like “site won’t open”).
 *
 * Timeout uses Promise.race (not AbortSignal) so Next.js fetch dedupe /
 * ISR cache keys stay stable across layout + page calls in one render.
 */

const API_BASE =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/api/v1";

/** ISR window for public marketing pages and fetches. */
export const PUBLIC_REVALIDATE_SECONDS = 60;

/** Hard ceiling for SSR public API waits (fail soft → empty / Suspense fallback). */
export const PUBLIC_FETCH_TIMEOUT_MS = 8_000;

export async function fetchPublicJson<T>(
  path: string,
  revalidate = PUBLIC_REVALIDATE_SECONDS,
  tags: string[] = [],
  timeoutMs = PUBLIC_FETCH_TIMEOUT_MS,
): Promise<T | null> {
  try {
    const url = path.startsWith("http")
      ? path
      : `${API_BASE}${path.startsWith("/") ? path : `/${path}`}`;

    const fetchPromise = fetch(url, {
      next: {
        revalidate,
        ...(tags.length ? { tags } : {}),
      },
      headers: { Accept: "application/json" },
    });

    let timer: ReturnType<typeof setTimeout> | undefined;
    const timeoutPromise = new Promise<never>((_, reject) => {
      timer = setTimeout(
        () => reject(new Error("PUBLIC_FETCH_TIMEOUT")),
        timeoutMs,
      );
    });

    try {
      const res = await Promise.race([fetchPromise, timeoutPromise]);
      if (!res.ok) return null;
      const json = (await res.json()) as {
        success?: boolean;
        data?: T;
      };
      if (!json?.success || json.data === undefined) return null;
      return json.data;
    } finally {
      if (timer) clearTimeout(timer);
    }
  } catch {
    return null;
  }
}
