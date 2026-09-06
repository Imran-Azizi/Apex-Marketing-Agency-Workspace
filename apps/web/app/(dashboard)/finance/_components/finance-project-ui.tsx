import { cn } from "@/lib/utils";
import {
  getCustomerListDisplay,
  getCustomerPersonName,
} from "@/lib/crm-customer-name";
import { getProjectStatusLabel } from "@/lib/project-status";
import type { FinanceProject } from "./types";

export const VERIFICATION_LABELS: Record<string, string> = {
  VERIFIED: "تأییدشده",
  PENDING: "در انتظار",
  REJECTED: "ردشده",
};

export function verificationLabel(status: string) {
  return VERIFICATION_LABELS[status] || status;
}

export function settlementBadgeVariant(
  status?: string | null,
): "success" | "warning" | "secondary" | "outline" {
  const value = String(status || "").toUpperCase();
  if (value === "PAID") return "success";
  if (value === "PARTIAL") return "warning";
  if (value === "UNPAID") return "secondary";
  return "outline";
}

export function projectStatusBadgeVariant(
  project: Pick<FinanceProject, "status" | "isComplete">,
): "success" | "brand" | "secondary" | "outline" | "warning" {
  if (project.isComplete || project.status === "COMPLETED") return "success";
  if (project.status === "ON_HOLD") return "warning";
  if (project.status === "CANCELED" || project.status === "CANCELLED") {
    return "secondary";
  }
  return "outline";
}

export function projectLifecycleLabel(
  project: Pick<FinanceProject, "status" | "isComplete">,
): string {
  if (project.isComplete || project.status === "COMPLETED") return "تکمیل‌شده";
  return getProjectStatusLabel(project.status);
}

export function paymentProgressPct(total: number, paid: number) {
  if (total <= 0) return 0;
  return Math.min(100, Math.round((Math.max(0, paid) / total) * 100));
}

export function customerDisplayName(
  customer: FinanceProject["customer"],
): string {
  return getCustomerPersonName(customer);
}

export function customerListDisplay(customer: FinanceProject["customer"]) {
  return getCustomerListDisplay(customer);
}

export function settlementLabel(project: FinanceProject) {
  return (
    project.settlementStatusLabel ||
    (project.settlementStatus === "PAID"
      ? "تسویه‌شده"
      : project.settlementStatus === "PARTIAL"
        ? "پرداخت جزئی"
        : "پرداخت‌نشده")
  );
}

export function PaymentProgressBar({
  total,
  paid,
  compact = false,
}: {
  total: number;
  paid: number;
  compact?: boolean;
}) {
  const pct = paymentProgressPct(total, paid);
  return (
    <div className={cn("flex items-center gap-2", compact ? "min-w-[5.5rem]" : "w-full")}>
      {!compact ? (
        <span className="shrink-0 text-[11px] text-muted-foreground">پیشرفت پرداخت</span>
      ) : null}
      <div
        className={cn(
          "overflow-hidden rounded-full bg-muted",
          compact ? "h-1.5 flex-1 min-w-[3rem]" : "h-1.5 flex-1",
        )}
      >
        <div
          className={cn(
            "h-full rounded-full",
            pct >= 100 ? "bg-emerald-500" : pct > 0 ? "bg-brand" : "bg-transparent",
          )}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
        {pct}٪
      </span>
    </div>
  );
}
