"use client";

import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { apiGet } from "@/lib/api";
import { hasPermission } from "@/lib/rbac";
import { useMeQuery } from "@/lib/permissions";
import { ErrorState } from "@/components/loading/error-state";
import { Skeleton } from "@/components/ui/skeleton";
import { LandingBuilder } from "./_components/landing-builder";
import type { LandingPage } from "@/lib/landing-pages";

export default function LandingPageBuilderPage() {
  const params = useParams<{ id: string }>();
  const { data: me } = useMeQuery();
  const canEdit = hasPermission(me?.permissions, "landing_pages.edit", me?.role);
  const canPublish = hasPermission(
    me?.permissions,
    "landing_pages.publish",
    me?.role,
  );

  const query = useQuery({
    queryKey: ["landing-page", params.id],
    queryFn: () => apiGet<LandingPage>(`/landing-pages/${params.id}`),
    enabled: Boolean(params.id),
  });

  if (query.isLoading) {
    return (
      <div className="absolute inset-0 flex flex-col gap-3 p-3 sm:p-4" dir="rtl">
        <Skeleton className="h-12 w-full shrink-0 rounded-xl" />
        <Skeleton className="min-h-0 flex-1 w-full rounded-2xl" />
      </div>
    );
  }

  if (query.isError || !query.data) {
    return (
      <div className="absolute inset-0 flex items-center justify-center p-6">
        <ErrorState
          title="بارگذاری صفحه لندنگ ناموفق بود"
          description="این صفحه ممکن است حذف شده باشد."
          onRetry={() => query.refetch()}
        />
      </div>
    );
  }

  return (
    <LandingBuilder
      initial={query.data}
      canEdit={canEdit}
      canPublish={canPublish}
    />
  );
}
