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

/**
 * Best playback URL for the public portfolio player.
 * Always uses the opaque ranged stream endpoint — never embeds durable CDN
 * file URLs in the page (download deterrence for نمونه های کاری).
 */
export function portfolioPublicPlaybackUrl(item: {
  id: string;
  video?: { playbackUrl?: string | null; streamPath?: string | null } | null;
}): string {
  return portfolioPublicStreamUrl(item.id);
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
