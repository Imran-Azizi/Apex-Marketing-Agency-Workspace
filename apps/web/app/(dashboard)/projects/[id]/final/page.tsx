"use client";

import { use, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Skeleton } from "@/components/ui/skeleton";

/** Legacy route — redirects into production workspace «محصول نهایی» tab. */
export default function ProjectFinalProductRedirectPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();

  useEffect(() => {
    router.replace(`/projects/${id}?tab=production&workspace=final`);
  }, [id, router]);

  return (
    <div className="space-y-4 py-4" dir="rtl" aria-busy="true">
      <Skeleton className="h-8 w-48 rounded-lg" />
      <Skeleton className="h-40 w-full rounded-2xl" />
    </div>
  );
}
