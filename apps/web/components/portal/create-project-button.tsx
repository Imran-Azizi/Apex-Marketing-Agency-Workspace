"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { PlusCircle, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { apiPost, ApiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { CREATE_PROJECT_DENIED_MESSAGE } from "@/lib/portal";
import { cn } from "@/lib/utils";

type CreateProjectButtonProps = {
  canCreate: boolean;
  pendingBriefsCount?: number;
  pipelineStage?: string | null;
  className?: string;
  size?: "default" | "sm" | "lg";
  variant?: "brand" | "outline" | "default";
};

export function CreateProjectButton({
  canCreate,
  pendingBriefsCount = 0,
  pipelineStage = null,
  className,
  size = "default",
  variant = "brand",
}: CreateProjectButtonProps) {
  const router = useRouter();
  const qc = useQueryClient();
  const [starting, setStarting] = useState(false);

  const startOrder = useMutation({
    mutationFn: () =>
      apiPost<{ opportunityId: string }>("/portal/orders", {
        description: "درخواست ایجاد پروژه جدید از پورتال مشتری",
      }),
  });

  async function handleClick() {
    if (!canCreate) {
      toast.error(CREATE_PROJECT_DENIED_MESSAGE, { duration: 5000 });
      return;
    }

    if (pendingBriefsCount > 0) {
      router.push("/portal/brief");
      return;
    }

    if (pipelineStage !== "REPEAT_CUSTOMER") {
      toast.error(CREATE_PROJECT_DENIED_MESSAGE, { duration: 5000 });
      return;
    }

    try {
      setStarting(true);
      const res = await startOrder.mutateAsync();
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["pending-briefs"] }),
        qc.invalidateQueries({ queryKey: ["portal-dashboard"] }),
        qc.invalidateQueries({ queryKey: ["portal-projects"] }),
      ]);
      router.push(
        `/portal/brief?opportunityId=${encodeURIComponent(res.opportunityId)}`,
      );
    } catch (err) {
      const message =
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : CREATE_PROJECT_DENIED_MESSAGE;
      toast.error(message);
    } finally {
      setStarting(false);
    }
  }

  const busy = starting || startOrder.isPending;

  return (
    <Button
      type="button"
      variant={variant}
      size={size}
      className={cn(!canCreate && "opacity-70", className)}
      onClick={() => void handleClick()}
      disabled={busy}
      aria-disabled={!canCreate || busy}
    >
      {busy ? (
        <Loader2 className="h-4 w-4 shrink-0 animate-spin" />
      ) : (
        <PlusCircle className="h-4 w-4 shrink-0" />
      )}
      <span className="sm:hidden">پروژه جدید</span>
      <span className="hidden sm:inline">ایجاد پروژه جدید</span>
    </Button>
  );
}
