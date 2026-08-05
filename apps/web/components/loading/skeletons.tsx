import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";

interface CardSkeletonProps {
  className?: string;
  /** Show avatar circle */
  withAvatar?: boolean;
  lines?: number;
}

export function CardSkeleton({
  className,
  withAvatar = false,
  lines = 2,
}: CardSkeletonProps) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-border/70 bg-card p-4 shadow-sm",
        className,
      )}
    >
      <div className="flex items-start justify-between gap-3">
        {withAvatar ? (
          <Skeleton className="h-10 w-10 shrink-0 rounded-xl" />
        ) : (
          <Skeleton className="h-10 w-10 shrink-0 rounded-xl" />
        )}
        <Skeleton className="h-5 w-14 rounded-full" />
      </div>
      <Skeleton className="mt-4 h-3 w-20" />
      <Skeleton className="mt-2 h-6 w-28" />
      {Array.from({ length: Math.max(0, lines - 1) }).map((_, i) => (
        <Skeleton
          key={i}
          className={cn("mt-2 h-3", i === 0 ? "w-3/4" : "w-1/2")}
        />
      ))}
    </div>
  );
}

interface KpiSkeletonGridProps {
  count?: number;
  className?: string;
}

export function KpiCardSkeletonGrid({
  count = 4,
  className,
}: KpiSkeletonGridProps) {
  return (
    <div
      className={cn(
        "grid gap-3 sm:grid-cols-2 lg:grid-cols-4",
        className,
      )}
    >
      {Array.from({ length: count }).map((_, i) => (
        <CardSkeleton key={i} />
      ))}
    </div>
  );
}

export function ChartSkeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-border/70 bg-card p-4 shadow-sm sm:p-5",
        className,
      )}
    >
      <div className="mb-4 space-y-2">
        <Skeleton className="h-5 w-40" />
        <Skeleton className="h-3 w-56" />
      </div>
      <div className="flex h-[220px] items-end gap-2 px-2 pb-2 pt-6 sm:gap-3">
        {[40, 65, 45, 80, 55, 70, 50, 85].map((h, i) => (
          <Skeleton
            key={i}
            className="flex-1 rounded-t-md"
            style={{ height: `${h}%` }}
          />
        ))}
      </div>
    </div>
  );
}

export function ListItemSkeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "flex items-start gap-3 rounded-xl border border-border/50 bg-card p-3",
        className,
      )}
    >
      <Skeleton className="mt-0.5 h-9 w-9 shrink-0 rounded-full" />
      <div className="min-w-0 flex-1 space-y-2">
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-3 w-full" />
        <Skeleton className="h-3 w-1/3" />
      </div>
    </div>
  );
}

export function NotificationListSkeleton({
  count = 5,
}: {
  count?: number;
}) {
  return (
    <div className="space-y-2 p-3" aria-busy="true" aria-label="در حال بارگذاری اعلان‌ها">
      {Array.from({ length: count }).map((_, i) => (
        <ListItemSkeleton key={i} />
      ))}
    </div>
  );
}

export function PageHeaderSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn("space-y-2", className)}>
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-4 w-72 max-w-full" />
    </div>
  );
}

export function DashboardSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn("space-y-6", className)} aria-busy="true">
      <PageHeaderSkeleton />
      <KpiCardSkeletonGrid />
      <div className="grid gap-4 xl:grid-cols-2">
        <ChartSkeleton />
        <ChartSkeleton />
      </div>
    </div>
  );
}
