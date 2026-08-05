"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

const BOOT_KEY = "apex-boot-seen";

/**
 * Lightweight first-paint brand splash (once per tab session).
 * Exits on the next frames — no artificial delay.
 */
export function AppBootLoader() {
  const [phase, setPhase] = useState<"hidden" | "show" | "exit">("hidden");

  useEffect(() => {
    try {
      if (sessionStorage.getItem(BOOT_KEY) === "1") return;
      sessionStorage.setItem(BOOT_KEY, "1");
    } catch {
      // private mode — still show once this mount
    }

    setPhase("show");
    const exit = requestAnimationFrame(() => {
      requestAnimationFrame(() => setPhase("exit"));
    });
    const gone = window.setTimeout(() => setPhase("hidden"), 280);
    return () => {
      cancelAnimationFrame(exit);
      window.clearTimeout(gone);
    };
  }, []);

  if (phase === "hidden") return null;

  return (
    <div
      role="status"
      aria-live="polite"
      aria-label="در حال بارگذاری اپیکس"
      className={cn(
        "fixed inset-0 z-[200] flex flex-col items-center justify-center gap-5 bg-background",
        "transition-opacity duration-200 ease-out",
        phase === "exit" ? "pointer-events-none opacity-0" : "opacity-100",
      )}
    >
      <div className="relative">
        <div className="relative flex h-14 w-14 items-center justify-center rounded-2xl bg-brand text-xl font-black text-brand-foreground shadow-lg shadow-brand/25">
          ا
        </div>
      </div>
      <div className="h-1 w-28 overflow-hidden rounded-full bg-secondary">
        <div className="h-full w-1/3 animate-progress-indeterminate rounded-full bg-brand" />
      </div>
    </div>
  );
}
