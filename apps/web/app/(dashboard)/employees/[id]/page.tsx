"use client";

import { useParams, useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { apiGet } from "@/lib/api";
import { getMe } from "@/lib/auth";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import {
  EmployeeProfileSkeleton,
  EmployeeProfileView,
} from "../_components/employee-profile-view";
import type { Employee } from "../_components/types";

export default function EmployeeProfilePage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const id = params.id;

  const me = useQuery({
    queryKey: ["me", "internal"],
    queryFn: getMe,
    staleTime: 5 * 60_000,
  });

  const { data, isLoading, error } = useQuery({
    queryKey: ["employee", id],
    queryFn: () => apiGet<Employee>(`/employees/${id}`),
    enabled: Boolean(id),
  });

  if (isLoading) {
    return <EmployeeProfileSkeleton />;
  }

  if (error || !data) {
    return (
      <EmptyState
        title="کارمند یافت نشد"
        description="این پروفایل وجود ندارد یا حذف شده است."
        action={
          <Button variant="outline" onClick={() => router.push("/employees")}>
            بازگشت به لیست
          </Button>
        }
      />
    );
  }

  return (
    <EmployeeProfileView employee={data} currentUserId={me.data?.id} />
  );
}
