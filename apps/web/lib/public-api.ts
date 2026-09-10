/**
 * Server-only fetch helpers for public marketing APIs.
 * Uses Next.js fetch cache so layout + page requests dedupe in one render.
 */

const API_BASE =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/api/v1";

export async function fetchPublicJson<T>(
  path: string,
  revalidate = 60,
): Promise<T | null> {
  try {
    const url = path.startsWith("http")
      ? path
      : `${API_BASE}${path.startsWith("/") ? path : `/${path}`}`;
    const res = await fetch(url, {
      next: { revalidate },
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
