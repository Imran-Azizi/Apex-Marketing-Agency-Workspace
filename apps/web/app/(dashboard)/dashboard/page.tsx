"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { getMe, isInternalUser } from "@/lib/auth";
import { getHomePath } from "@/lib/rbac";
import { Skeleton } from "@/components/ui/skeleton";

/** Legacy route — redirects each role to its dedicated home panel. */
export default function DashboardRedirectPage() {
  const router = useRouter();
  const { data: me, isLoading, isFetching } = useQuery({
    queryKey: ["me", "internal"],
    queryFn: getMe,
    retry: false,
  });

  useEffect(() => {
    if (isLoading || isFetching) return;
    if (!isInternalUser(me)) {
      router.replace("/login");
      return;
    }
    router.replace(getHomePath(me.role));
  }, [isLoading, isFetching, me, router]);

  return (
    <div className="space-y-4">
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-40 w-full" />
    </div>
  );
}
