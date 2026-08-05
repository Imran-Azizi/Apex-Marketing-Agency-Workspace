"use client";

import { useEffect, useRef } from "react";
import { silentRefresh } from "@/lib/api";

/**
 * Silently renews the access token while the tab is open so users are not
 * logged out after the short-lived access JWT expires.
 * Refresh runs when the tab becomes visible and on a fixed interval.
 */
export function SessionKeepAlive({
  intervalMs = 10 * 60 * 1000,
}: {
  intervalMs?: number;
}) {
  const inFlight = useRef(false);

  useEffect(() => {
    async function renew() {
      if (inFlight.current || document.visibilityState === "hidden") return;
      inFlight.current = true;
      try {
        await silentRefresh();
      } finally {
        inFlight.current = false;
      }
    }

    // Warm the session shortly after mount (covers near-expiry access tokens).
    const initial = window.setTimeout(renew, 5_000);
    const timer = window.setInterval(renew, intervalMs);

    function onVisibility() {
      if (document.visibilityState === "visible") renew();
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
