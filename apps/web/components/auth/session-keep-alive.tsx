"use client";

import { useEffect, useRef } from "react";
import { silentRefresh } from "@/lib/auth-refresh";

/** Default: 8 min — safely under the 15 min access-token TTL. */
const DEFAULT_INTERVAL_MS = 8 * 60 * 1000;

/**
 * Silently renews the access token while the tab is open so users are not
 * logged out after the short-lived access JWT expires.
 * Refresh runs when the tab becomes visible and on a fixed interval.
 */
export function SessionKeepAlive({
  intervalMs = DEFAULT_INTERVAL_MS,
}: {
  intervalMs?: number;
}) {
  const inFlight = useRef(false);

  useEffect(() => {
    async function renew(force = false) {
      if (inFlight.current) return;
      if (!force && document.visibilityState === "hidden") return;
      inFlight.current = true;
      try {
        await silentRefresh();
      } finally {
        inFlight.current = false;
      }
    }

    // Warm the session shortly after mount (covers near-expiry access tokens).
    const initial = window.setTimeout(() => renew(true), 5_000);
    const timer = window.setInterval(() => renew(false), intervalMs);

    function onVisibility() {
      if (document.visibilityState === "visible") renew(true);
    }
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      window.clearTimeout(initial);
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [intervalMs]);

  return null;
}
