"use client";

import { Badge } from "@/components/ui/badge";
import { getCustomerFacingStatusLabel } from "@/lib/project-status";
import { cn } from "@/lib/utils";

export function PortalStatusBadge({
  status,
  className,
}: {
  status: string;
  className?: string;
}) {
  const variant =
    status === "COMPLETED"
      ? "secondary"
      : status === "WAITING_YOUR_APPROVAL" || status === "FINAL_REVIEW"
        ? "brand"
        : "outline";

  return (
    <Badge variant={variant as "secondary" | "brand" | "outline"} className={cn(className)}>
      {getCustomerFacingStatusLabel(status)}
    </Badge>
  );
}
