"use client";

import { useEffect } from "react";
import {
  registerApexServiceWorker,
  syncWebPushSubscription,
} from "@/lib/web-push-client";

/** Let auth + first screen settle before SW/push network work on weak links. */
const BOOTSTRAP_DELAY_MS = 8_000;

/**
 * Registers the service worker and re-syncs an existing granted push subscription
 * for the signed-in dashboard / portal session.
 */
export function WebPushBootstrap() {
  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      await registerApexServiceWorker();
      if (cancelled) return;
      await syncWebPushSubscription();
    };

    const timer = window.setTimeout(() => {
      void run();
    }, BOOTSTRAP_DELAY_MS);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, []);

  return null;
}
