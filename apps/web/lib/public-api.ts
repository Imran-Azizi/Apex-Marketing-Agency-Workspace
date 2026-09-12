/**
 * Server-only fetch helpers for public marketing APIs.
 * Uses Next.js fetch cache so layout + page requests dedupe in one render.
 */

const API_BASE =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/api/v1";

/** ISR window for public marketing pages and fetches. */
export const PUBLIC_REVALIDATE_SECONDS = 60;

export async function fetchPublicJson<T>(
  path: string,
  revalidate = PUBLIC_REVALIDATE_SECONDS,
  tags: string[] = [],
): Promise<T | null> {
  try {
    const url = path.startsWith("http")
      ? path
      : `${API_BASE}${path.startsWith("/") ? path : `/${path}`}`;
    const res = await fetch(url, {
      next: {
        revalidate,
        ...(tags.length ? { tags } : {}),
      },
      headers: { Accept: "application/json" },
    });
    if (!res.ok) return null;
    const json = (await res.json()) as {
      success?: boolean;
      data?: T;
    };
    if (!json?.success || json.data === undefined) return null;
    return json.data;
  } catch {
    return null;
  }
}
