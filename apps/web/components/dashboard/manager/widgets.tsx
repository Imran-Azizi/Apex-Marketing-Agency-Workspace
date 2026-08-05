"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import {
  ArrowDownRight,
  ArrowUpRight,
  Minus,
  type LucideIcon,
} from "lucide-react";
import { cn, formatCurrency } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { TONE_CARD, TONE_ICON } from "@/lib/theme-tones";
import type { KpiMetric } from "./types";

export function SectionShell({
  title,
  description,
  action,
  children,
  className,
  id,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  id?: string;
}) {
  return (
    <section
      id={id}
      className={cn(
        "scroll-mt-24 rounded-2xl border border-border/70 bg-card/80 p-4 shadow-sm backdrop-blur-sm sm:p-5",
        className,
      )}
      aria-labelledby={`section-${title.replace(/\s+/g, "-")}`}
    >
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <h2
            id={`section-${title.replace(/\s+/g, "-")}`}
            className="text-base font-semibold tracking-tight text-foreground"
          >
            {title}
          </h2>
          {description ? (
            <p className="text-sm text-muted-foreground">{description}</p>
          ) : null}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

export function AnimatedNumber({
  value,
  format = "number",
  className,
}: {
  value: number;
  format?: KpiMetric["format"];
  className?: string;
}) {
  const [display, setDisplay] = useState(value);

  useEffect(() => {
    let frame = 0;
    const start = performance.now();
    const from = display;
    const duration = 550;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplay(from + (value - from) * eased);
      if (t < 1) frame = requestAnimationFrame(tick);
      else setDisplay(value);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [value]); // eslint-disable-line react-hooks/exhaustive-deps -- animate from last painted value

  const rounded =
    format === "percent" || format === "days"
      ? Math.round(display * 10) / 10
      : Math.round(display);

  let text: string;
  if (format === "currency") text = formatCurrency(rounded);
  else if (format === "percent") text = `${rounded}%`;
  else if (format === "days") text = `${rounded} روز`;
  else
    text = new Intl.NumberFormat("fa-AF", { numberingSystem: "latn" }).format(
      rounded,
    );

  return (
    <span className={cn("tabular-nums tracking-tight", className)}>{text}</span>
  );
}

function MiniSparkline({ values }: { values: number[] }) {
  if (!values.length) return null;
  const max = Math.max(...values, 1);
  const w = 64;
  const h = 24;
  const step = values.length > 1 ? w / (values.length - 1) : w;
  const points = values
    .map((v, i) => `${i * step},${h - (v / max) * (h - 2)}`)
    .join(" ");

  return (
    <svg
      width={w}
      height={h}
      viewBox={`0 0 ${w} ${h}`}
      className="opacity-70"
      aria-hidden
    >
      <polyline
        fill="none"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
        points={points}
      />
    </svg>
  );
}

export function KpiCard({
  metric,
  icon: Icon,
}: {
  metric: KpiMetric;
  icon: LucideIcon;
}) {
  const tone = metric.tone || "default";
  const TrendIcon =
    metric.trendPct == null
      ? Minus
      : metric.trendPct > 0
        ? ArrowUpRight
        : metric.trendPct < 0
          ? ArrowDownRight
          : Minus;

  const body = (
    <div
      className={cn(
        "group relative flex h-full flex-col gap-3 rounded-2xl border p-4 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md",
        TONE_CARD[tone],
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <p className="text-xs font-medium text-muted-foreground">{metric.label}</p>
          <p className="text-2xl font-bold text-foreground">
            <AnimatedNumber value={metric.value} format={metric.format} />
          </p>
          {metric.description ? (
            <p className="text-[11px] leading-5 text-muted-foreground">
              {metric.description}
            </p>
          ) : null}
        </div>
        <span
          className={cn(
            "inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-transform group-hover:scale-105",
            TONE_ICON[tone],
          )}
        >
          <Icon className="h-5 w-5" aria-hidden />
        </span>
      </div>

      <div className="mt-auto flex items-end justify-between gap-2">
        <div className="min-w-0 flex-1 space-y-1.5">
          {typeof metric.progress === "number" ? (
            <div
              className="h-1.5 overflow-hidden rounded-full bg-muted"
              role="progressbar"
              aria-valuenow={metric.progress}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label={metric.label}
            >
              <div
                className="h-full rounded-full bg-brand transition-all duration-500"
                style={{ width: `${Math.min(100, Math.max(0, metric.progress))}%` }}
              />
            </div>
          ) : null}
          {metric.trendPct != null ? (
            <span
              className={cn(
                "inline-flex items-center gap-0.5 text-[11px] font-medium",
                metric.trendPct > 0
                  ? "text-emerald-600 dark:text-emerald-400"
                  : metric.trendPct < 0
                    ? "text-destructive"
                    : "text-muted-foreground",
              )}
            >
              <TrendIcon className="h-3.5 w-3.5" aria-hidden />
              {metric.trendPct > 0 ? "+" : ""}
              {metric.trendPct}% نسبت به بازه قبل
            </span>
          ) : null}
        </div>
        {metric.sparkline?.length ? (
          <span className={cn(TONE_ICON[tone], "rounded-md p-1 text-current")}>
            <MiniSparkline values={metric.sparkline} />
          </span>
        ) : null}
      </div>
    </div>
  );

  if (metric.href) {
    return (
      <Link href={metric.href} className="block h-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded-2xl">
        {body}
      </Link>
    );
  }
  return body;
}

export function KpiSkeletonGrid({ count = 8 }: { count?: number }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {Array.from({ length: count }).map((_, i) => (
        <Skeleton key={i} className="h-[132px] rounded-2xl" />
      ))}
    </div>
  );
}

export function PriorityDot({
  priority,
}: {
  priority: "critical" | "high" | "medium" | "low";
}) {
  const colors = {
    critical: "bg-destructive",
    high: "bg-orange-500",
    medium: "bg-amber-400",
    low: "bg-emerald-500",
  };
  const labels = {
    critical: "بحرانی",
    high: "بالا",
    medium: "متوسط",
    low: "پایین",
  };
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
      <span
        className={cn("h-2 w-2 rounded-full", colors[priority])}
        aria-hidden
      />
      <span className="sr-only">اولویت {labels[priority]}</span>
      {labels[priority]}
    </span>
  );
}

export function EmptyInline({ message }: { message: string }) {
  return (
    <p className="rounded-xl border border-dashed border-border/80 px-4 py-8 text-center text-sm text-muted-foreground">
      {message}
    </p>
  );
}
