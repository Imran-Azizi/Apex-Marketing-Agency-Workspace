import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function CrmSectionHeader({
  icon: Icon,
  title,
  description,
  action,
  className,
}: {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      dir="rtl"
      className={cn(
        "flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between",
        className,
      )}
    >
      <div className="flex items-start gap-3">
        {Icon && (
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-brand/10 text-brand shadow-sm ring-1 ring-brand/15">
            <Icon className="h-5 w-5" />
          </div>
        )}
        <div className="min-w-0 text-start">
          <h3 className="text-base font-bold tracking-tight text-foreground sm:text-lg">
            {title}
          </h3>
          {description && (
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground sm:text-sm">
              {description}
            </p>
          )}
        </div>
      </div>
      {action ? <div className="shrink-0 sm:pt-1">{action}</div> : null}
    </div>
  );
}

export function CrmInfoTile({
  icon: Icon,
  label,
  value,
  dir,
  onClick,
  disabled,
  hint,
  className,
}: {
  icon: LucideIcon;
  label: string;
  value: React.ReactNode;
  dir?: "ltr" | "rtl";
  onClick?: () => void;
  disabled?: boolean;
  hint?: string;
  className?: string;
}) {
  const Wrapper = onClick ? "button" : "div";

  return (
    <Wrapper
      type={onClick ? "button" : undefined}
      onClick={onClick}
      disabled={disabled}
      dir="rtl"
      className={cn(
        "group flex w-full items-center gap-3 rounded-2xl border border-border/50 bg-card p-4 text-start shadow-sm",
        "transition-all duration-200",
        onClick &&
          !disabled &&
          "cursor-pointer hover:-translate-y-0.5 hover:border-brand/35 hover:bg-brand/[0.04] hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40",
        disabled && "cursor-not-allowed opacity-70",
        className,
      )}
    >
      <div
        className={cn(
          "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-muted/70 text-muted-foreground transition-colors",
          onClick &&
            !disabled &&
            "group-hover:bg-brand/10 group-hover:text-brand",
        )}
      >
        <Icon className="h-[18px] w-[18px]" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-medium text-muted-foreground">{label}</p>
        <p
          dir={dir || "rtl"}
          className={cn(
            "mt-1 truncate text-sm font-semibold text-foreground",
            dir === "ltr" && "tabular-nums tracking-wide [unicode-bidi:isolate]",
          )}
        >
          {value}
        </p>
        {hint && (
          <p className="mt-1.5 text-[11px] leading-relaxed text-destructive">
            {hint}
          </p>
        )}
      </div>
    </Wrapper>
  );
}

export function CrmSubSection({
  title,
  description,
  icon: Icon,
  children,
  className,
}: {
  title: string;
  description?: string;
  icon?: LucideIcon;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      dir="rtl"
      className={cn(
        "rounded-2xl border border-border/50 bg-muted/20 p-4 shadow-sm sm:p-5",
        className,
      )}
    >
      <div className="mb-4 flex items-start gap-3">
        {Icon && (
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-background text-brand shadow-sm ring-1 ring-border/60">
            <Icon className="h-4 w-4" />
          </div>
        )}
        <div className="min-w-0 text-start">
          <h4 className="text-sm font-bold">{title}</h4>
          {description && (
            <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
              {description}
            </p>
          )}
        </div>
      </div>
      {children}
    </div>
  );
}

/** Shared currency field — RTL layout with numbers right-aligned */
export function CrmCurrencyField({
  id,
  label,
  value,
  onChange,
  placeholder = "0",
  readOnly = false,
  hint,
}: {
  id: string;
  label: string;
  value: string;
  onChange?: (value: string) => void;
  placeholder?: string;
  readOnly?: boolean;
  hint?: string;
}) {
  return (
    <div className="space-y-2" dir="rtl">
      <Label htmlFor={id} className="block text-xs font-medium text-start">
        {label}
      </Label>
      <div className="relative">
        <Input
          id={id}
          dir="ltr"
          type="text"
          inputMode="decimal"
          placeholder={placeholder}
          value={value}
          readOnly={readOnly}
          tabIndex={readOnly ? -1 : undefined}
          onChange={
            readOnly || !onChange ? undefined : (e) => onChange(e.target.value)
          }
          className={cn(
            "h-11 rounded-xl pe-14 ps-3 text-right tabular-nums shadow-sm",
            readOnly
              ? "cursor-default bg-muted/40 text-foreground"
              : "bg-background hover:border-brand/30",
          )}
        />
        <span className="pointer-events-none absolute inset-y-0 end-0 flex items-center pe-3">
          <span className="rounded-md bg-muted px-2 py-0.5 text-[11px] font-bold tracking-wide text-muted-foreground">
            AFN
          </span>
        </span>
      </div>
      {hint && (
        <p className="text-[11px] leading-relaxed text-muted-foreground text-start">
          {hint}
        </p>
      )}
    </div>
  );
}

export function CrmReadonlyMoneyCard({
  label,
  value,
  hint,
  tone = "default",
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: "default" | "success" | "warning" | "brand";
}) {
  return (
    <div
      dir="rtl"
      className={cn(
        "flex h-full flex-col justify-center rounded-2xl border p-4 shadow-sm",
        tone === "success" &&
          "border-emerald-200/70 bg-emerald-50/60 dark:border-emerald-500/20 dark:bg-emerald-500/5",
        tone === "warning" &&
          "border-amber-200/70 bg-amber-50/60 dark:border-amber-500/20 dark:bg-amber-500/5",
        tone === "brand" &&
          "border-brand/25 bg-brand/5",
        tone === "default" && "border-border/50 bg-muted/25",
      )}
    >
      <p className="text-xs font-medium text-muted-foreground text-start">
        {label}
      </p>
      <p
        dir="ltr"
        className="mt-2 text-right text-xl font-bold tabular-nums tracking-wide [unicode-bidi:isolate]"
      >
        {value}
      </p>
      {hint && (
        <p className="mt-1.5 text-[11px] leading-relaxed text-muted-foreground text-start">
          {hint}
        </p>
      )}
    </div>
  );
}
