import { API_BASE } from "@/lib/api";
import { resolveClientAuthPanel } from "@/lib/auth-panel";

/** Authenticated media stream URL for in-app <video>/<audio> players. */
export function mediaStreamUrl(fileId: string): string {
  const panel = resolveClientAuthPanel();
  const base = `${API_BASE}/files/media/${encodeURIComponent(fileId)}`;
  return panel ? `${base}?panel=${encodeURIComponent(panel)}` : base;
}

/** Public stream URL for a published portfolio item (no auth). */
export function portfolioPublicStreamUrl(portfolioId: string): string {
  return `${API_BASE}/public/portfolio/${encodeURIComponent(portfolioId)}/stream`;
}

/** JSON ticket that resolves a direct CDN (or stream fallback) playback URL. */
export function portfolioPublicPlaybackTicketUrl(portfolioId: string): string {
  return `${API_BASE}/public/portfolio/${encodeURIComponent(portfolioId)}/playback`;
}

/**
 * Opaque fallback stream URL kept in page markup for structured data /
 * no-JS fallback. Real playback prefers {@link resolvePortfolioPublicPlayback}.
 */
export function portfolioPublicPlaybackUrl(item: {
  id: string;
  video?: { playbackUrl?: string | null; streamPath?: string | null } | null;
}): string {
  return portfolioPublicStreamUrl(item.id);
}

const playbackTicketCache = new Map<string, { url: string; expiresAt: number }>();
const playbackTicketInflight = new Map<string, Promise<string>>();
const PLAYBACK_TICKET_TTL_MS = 45_000;

/**
 * Resolve a direct Bunny CDN URL at Play time so bytes never traverse the API.
 * Falls back to the opaque ranged stream endpoint when CDN is unavailable.
 * Results are cached briefly so hover/prefetch makes click-to-play instant.
 */
export async function resolvePortfolioPublicPlayback(portfolioId: string): Promise<string> {
  const id = String(portfolioId || "").trim();
  if (!id) throw new Error("آدرس پخش ویدیو در دسترس نیست.");

  const cached = playbackTicketCache.get(id);
  if (cached && cached.expiresAt > Date.now()) return cached.url;

  const inflight = playbackTicketInflight.get(id);
  if (inflight) return inflight;

  const request = (async () => {
    const res = await fetch(portfolioPublicPlaybackTicketUrl(id), {
      method: "GET",
      credentials: "omit",
      headers: { Accept: "application/json" },
      cache: "no-store",
    });
    if (!res.ok) {
      throw new Error("آماده‌سازی پخش ویدیو ناموفق بود");
    }
    const json = (await res.json()) as {
      success?: boolean;
      data?: { url?: string | null };
    };
    const raw = String(json?.data?.url || "").trim();
    if (!json?.success || !raw) {
      throw new Error("آدرس پخش ویدیو در دسترس نیست.");
    }
    let url = portfolioPublicStreamUrl(id);
    if (/^https?:\/\//i.test(raw)) {
      url = raw;
    } else if (raw.startsWith("/")) {
      try {
        url = new URL(raw, API_BASE.replace(/\/api\/v1\/?$/, "/")).toString();
      } catch {
        url = portfolioPublicStreamUrl(id);
      }
    }
    playbackTicketCache.set(id, {
      url,
      expiresAt: Date.now() + PLAYBACK_TICKET_TTL_MS,
    });
    return url;
  })().finally(() => {
    playbackTicketInflight.delete(id);
  });

  playbackTicketInflight.set(id, request);
  return request;
}

/** Warm CDN playback URL while the user is still on the poster (before Play). */
export function prefetchPortfolioPublicPlayback(portfolioId: string): void {
  void resolvePortfolioPublicPlayback(portfolioId).catch(() => {});
}

/** Authenticated stream URL for manager preview of any portfolio item. */
export function portfolioAdminStreamUrl(portfolioId: string): string {
  const panel = resolveClientAuthPanel();
  const base = `${API_BASE}/portfolio/${encodeURIComponent(portfolioId)}/stream`;
  return panel ? `${base}?panel=${encodeURIComponent(panel)}` : base;
}

/** Authenticated stream URL for company video library playback. */
export function videoStorageStreamUrl(videoId: string): string {
  const panel = resolveClientAuthPanel();
  const base = `${API_BASE}/video-storage/${encodeURIComponent(videoId)}/stream`;
  return panel ? `${base}?panel=${encodeURIComponent(panel)}` : base;
}

/** Authenticated thumbnail URL for company video library cards. */
export function videoStorageThumbnailUrl(videoId: string): string {
  const panel = resolveClientAuthPanel();
  const base = `${API_BASE}/video-storage/${encodeURIComponent(videoId)}/thumbnail`;
  return panel ? `${base}?panel=${encodeURIComponent(panel)}` : base;
}

export type VideoKindLabel = "WATERMARKED" | "CLEAN";

export const VIDEO_KIND_LABELS: Record<VideoKindLabel, string> = {
  WATERMARKED: "نسخه دارای واترمارک",
  CLEAN: "نسخه بدون واترمارک",
};
