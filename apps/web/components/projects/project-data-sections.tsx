"use client";

import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Sparkles, UserRound, type LucideIcon } from "lucide-react";

export type ProjectDataSectionId = "customer" | "apex";

export function ProjectSectionSwitcher({
  value,
  onChange,
  customerDescription,
  apexDescription,
  showCustomer = true,
  showApex = true,
  className,
}: {
  value: ProjectDataSectionId;
  onChange: (section: ProjectDataSectionId) => void;
  customerDescription?: string;
  apexDescription?: string;
  showCustomer?: boolean;
  showApex?: boolean;
  className?: string;
}) {
  const columns =
    showCustomer && showApex
      ? "sm:grid-cols-2"
      : "sm:grid-cols-1";

  return (
    <div
      role="tablist"
      aria-label="جداسازی اطلاعات مشتری و تیم APEX"
      className={cn("grid grid-cols-1 gap-2", columns, className)}
    >
      {showCustomer && (
        <SectionSwitchCard
          active={value === "customer"}
          onClick={() => onChange("customer")}
          icon={UserRound}
          title="اطلاعات مشتری"
          description={
            customerDescription ??
            "اطلاعات، نیازمندی‌ها و فایل‌های ارسال‌شده توسط مشتری"
          }
          tone="customer"
        />
      )}
      {showApex && (
        <SectionSwitchCard
          active={value === "apex"}
          onClick={() => onChange("apex")}
          icon={Sparkles}
          title="اطلاعات تیم APEX"
          description={
            apexDescription ??
            "برنامه‌ریزی، تولید، وضعیت و خروجی‌های مدیریت‌شده توسط تیم APEX"
          }
          tone="apex"
        />
      )}
    </div>
  );
}

function SectionSwitchCard({
  active,
  onClick,
  icon: Icon,
  title,
  description,
  tone,
}: {
  active: boolean;
  onClick: () => void;
  icon: LucideIcon;
  title: string;
  description: string;
  tone: "customer" | "apex";
}) {
  const isCustomer = tone === "customer";
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={cn(
        "relative flex h-auto flex-col items-stretch gap-1 overflow-hidden rounded-2xl border px-4 py-3.5 text-start shadow-sm",
        "transition-all duration-200 ease-out",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40 focus-visible:ring-offset-2",
        "after:absolute after:inset-x-4 after:bottom-0 after:h-[3px] after:rounded-full after:origin-center",
        "after:scale-x-0 after:opacity-0 after:transition-all after:duration-300",
        isCustomer
          ? active
            ? "border-border bg-muted/60 shadow-md ring-1 ring-border after:scale-x-100 after:opacity-100 after:bg-muted-foreground"
            : "bg-card hover:bg-muted/30 hover:shadow-md"
          : active
            ? "border-brand/40 bg-brand/[0.07] shadow-md ring-1 ring-brand/20 after:scale-x-100 after:opacity-100 after:bg-brand"
            : "bg-card hover:border-brand/20 hover:bg-muted/30 hover:shadow-md",
      )}
    >
      <span className="flex items-center gap-2 text-sm font-semibold">
        <span
          className={cn(
            "flex h-8 w-8 items-center justify-center rounded-xl transition-colors duration-200",
            isCustomer
              ? active
                ? "bg-muted text-foreground"
                : "bg-muted/70 text-muted-foreground"
              : active
                ? "bg-brand/15 text-brand shadow-sm"
                : "bg-brand/10 text-brand",
          )}
        >
          <Icon className="h-4 w-4" />
        </span>
        <span className={cn(active && (isCustomer ? "text-foreground" : "text-brand"))}>
          {title}
        </span>
      </span>
      <span className="text-[11px] font-normal leading-relaxed text-muted-foreground">
        {description}
      </span>
    </button>
  );
}

export function ProjectSectionShell({
  tone,
  title,
  badge,
  children,
  className,
}: {
  tone: "customer" | "apex";
  title: string;
  badge?: string;
  children: ReactNode;
  className?: string;
}) {
  const isCustomer = tone === "customer";
  return (
    <section
      className={cn(
        "overflow-hidden rounded-2xl border shadow-sm",
        isCustomer
          ? "border-border/80 bg-gradient-to-b from-muted/50 to-card"
          : "border-brand/20 bg-gradient-to-b from-brand/[0.06] to-card",
        className,
      )}
    >
      <div
        className={cn(
          "flex flex-wrap items-center justify-between gap-2 border-b px-4 py-3 sm:px-5",
          isCustomer
            ? "border-border/70"
            : "border-brand/15",
        )}
      >
        <div className="flex items-center gap-2">
          {isCustomer ? (
            <UserRound className="h-4 w-4 text-muted-foreground" />
          ) : (
            <Sparkles className="h-4 w-4 text-brand" />
          )}
          <h2 className="text-sm font-semibold">{title}</h2>
        </div>
        {badge && (
          isCustomer ? (
            <Badge variant="secondary" className="font-normal">
              {badge}
            </Badge>
          ) : (
            <Badge className="bg-brand/15 font-normal text-brand hover:bg-brand/15">
              {badge}
            </Badge>
          )
        )}
      </div>
      <div className="space-y-4 p-4 sm:p-5">{children}</div>
    </section>
  );
}
