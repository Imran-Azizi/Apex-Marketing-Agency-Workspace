"use client";

import { use } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight } from "lucide-react";
import { getMe, type MeResponse } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import {
  EditingMaterialsSkeleton,
  type ProductionWorkspaceTab,
} from "@/components/projects/editing-materials-panel";
import { ProjectProductionPanel } from "@/components/projects/project-production-panel";

function resolveWorkspaceParam(
  value: string | null,
): ProductionWorkspaceTab | undefined {
  if (
    value === "customer" ||
    value === "ai" ||
    value === "narration" ||
    value === "final"
  ) {
    return value;
  }
  return undefined;
}

export default function EditorTaskPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = use(params);
  const searchParams = useSearchParams();
  const initialWorkspace = resolveWorkspaceParam(searchParams.get("workspace"));
  const { data: me, isLoading } = useQuery({
    queryKey: ["me", "internal"],
    queryFn: getMe,
  });

  if (isLoading) {
    return (
      <div
        className="min-w-0 space-y-4 py-2 sm:py-4"
        dir="rtl"
        aria-busy="true"
        aria-label="در حال بارگذاری فضای ادیت"
      >
        <div className="h-8 w-40 rounded-lg bg-muted/60" />
        <EditingMaterialsSkeleton />
      </div>
    );
  }

  return (
    <div className="min-w-0 space-y-4 py-2 sm:py-4" dir="rtl">
      <nav aria-label="بازگشت">
        <Button
          variant="ghost"
          size="sm"
          className="gap-1.5 text-muted-foreground hover:text-foreground"
          asChild
        >
          <Link href="/editor/projects">
            <ArrowRight className="h-3.5 w-3.5" />
            پروژه‌های ادیت
          </Link>
        </Button>
      </nav>
      <ProjectProductionPanel
        projectId={projectId}
        roleCode={(me as MeResponse | null)?.role}
        initialWorkspaceTab={initialWorkspace}
      />
    </div>
  );
}
