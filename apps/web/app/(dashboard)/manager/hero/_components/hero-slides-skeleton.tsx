import { Skeleton } from "@/components/ui/skeleton";

export function HeroSlidesSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="flex gap-4 overflow-hidden rounded-2xl border border-border/70 bg-card p-3"
        >
          <Skeleton className="h-24 w-40 shrink-0 rounded-xl" />
          <div className="flex min-w-0 flex-1 flex-col justify-center gap-2">
            <Skeleton className="h-5 w-2/3" />
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-8 w-40" />
          </div>
        </div>
      ))}
    </div>
  );
}
