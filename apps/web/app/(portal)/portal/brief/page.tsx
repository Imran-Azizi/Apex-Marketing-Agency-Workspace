"use client";

import { Suspense } from "react";
import PortalBriefForm from "./brief-form";
import { Skeleton } from "@/components/ui/skeleton";

export default function PortalBriefPage() {
  return (
    <Suspense
      fallback={
        <div className="space-y-4">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-64 w-full" />
        </div>
      }
    >
      <PortalBriefForm />
    </Suspense>
  );
}
