/**
 * Shallow URL helpers for preserving tab state on refresh (no navigation).
 */
export function replaceTabSearchParams(
  updates: Record<string, string | null | undefined>,
) {
  if (typeof window === "undefined") return;
  const params = new URLSearchParams(window.location.search);
  for (const [key, value] of Object.entries(updates)) {
    if (value == null || value === "") params.delete(key);
    else params.set(key, value);
  }
  const query = params.toString();
  const next = query
    ? `${window.location.pathname}?${query}`
    : window.location.pathname;
  window.history.replaceState(window.history.state, "", next);
}
