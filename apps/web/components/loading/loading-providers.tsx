"use client";

import { Suspense } from "react";
import { AppBootLoader } from "@/components/loading/app-boot-loader";
import { NavigationProgress } from "@/components/loading/navigation-progress";

/** Client shell for boot splash + route progress (searchParams needs Suspense). */
export function LoadingProviders() {
  return (
    <>
      <AppBootLoader />
      <Suspense fallback={null}>
        <NavigationProgress />
      </Suspense>
    </>
  );
}
