"use client";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  STAGE_LABELS,
  stageBadgeVariant,
  stageControl,
  type StageControl,
} from "@/app/(dashboard)/crm-sales/_components/constants";

interface CustomerPipelineStatusBadgeProps {
  stage?: string | null;
  label?: string | null;
  className?: string;
  showControlHint?: boolean;
}

const CONTROL_HINT: Partial<Record<StageControl, string>> = {
  automatic: "خودکار",
  completed: "تکمیل",
  canceled: "لغو",
  repeat: "تکراری",
};

/** Read-only CRM pipeline stage badge — same labels/colors as CRM و فروش. */
export function CustomerPipelineStatusBadge({
  stage,
  label,
  className,
  showControlHint = false,
}: CustomerPipelineStatusBadgeProps) {
  const code = stage?.trim() || "NEW_LEAD";
  const text = label?.trim() || STAGE_LABELS[code] || STAGE_LABELS.NEW_LEAD;
  const control = stageControl(code);
  const hint = showControlHint ? CONTROL_HINT[control] : null;

  return (
    <Badge
      variant={stageBadgeVariant(code)}
      className={cn(
        "rounded-full font-normal whitespace-nowrap",
        control === "automatic" && "border border-amber-500/25",
        control === "completed" && "border border-emerald-500/25",
        control === "repeat" && "border border-brand/30",
        className,
      )}
      title={
        control === "automatic"
          ? "این وضعیت توسط سیستم به‌صورت خودکار به‌روز می‌شود"
          : control === "manual"
            ? "قابل تغییر دستی"
            : undefined
      }
    >
      {text}
      {hint ? (
        <span className="ms-1.5 text-[10px] opacity-70">{hint}</span>
      ) : null}
    </Badge>
  );
}
