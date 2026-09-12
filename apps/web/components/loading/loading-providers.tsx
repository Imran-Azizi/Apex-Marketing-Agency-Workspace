"use client";

import { Suspense } from "react";
import { NavigationProgress } from "@/components/loading/navigation-progress";

/** Route progress only — public first paint must not wait on a splash overlay. */
export function LoadingProviders() {
  return (
    <Suspense fallback={null}>
      <NavigationProgress />
    </Suspense>
  );
}
