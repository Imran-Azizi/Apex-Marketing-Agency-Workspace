"use client";

import { Badge } from "@/components/ui/badge";
import { crmSalesText } from "./copy";
import type { CrmCustomer } from "./types";

interface CustomerManagementIndicatorProps {
  customer: CrmCustomer;
  className?: string;
}

/** Shows whether the customer is listed in مدیریت مشتری (transferred, not delivered). */
export function CustomerManagementIndicator({
  customer,
  className,
}: CustomerManagementIndicatorProps) {
  const inManagement =
    Boolean(customer.convertedAt) && customer.pipelineStage !== "DELIVERED";
  if (!inManagement) return null;

  return (
    <Badge
      variant="secondary"
      className={
        className ??
        "mt-1 rounded-full border border-brand/20 bg-brand/10 font-normal text-brand"
      }
    >
      {crmSalesText("managementSentBadge")}
    </Badge>
  );
}
