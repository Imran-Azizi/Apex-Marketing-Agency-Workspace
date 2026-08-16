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
export type VideoKindLabel = "WATERMARKED" | "CLEAN";

export const VIDEO_KIND_LABELS: Record<VideoKindLabel, string> = {
  WATERMARKED: "نسخه دارای واترمارک",
  CLEAN: "نسخه بدون واترمارک",
};
