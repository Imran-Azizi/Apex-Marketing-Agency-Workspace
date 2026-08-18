import { Skeleton } from "@/components/ui/skeleton";

export function CustomersSkeleton({ count = 8 }: { count?: number }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="flex flex-col items-center rounded-2xl border border-border/70 bg-card px-3.5 pb-3.5 pt-4"
        >
          <Skeleton className="size-20 rounded-full" />
          <Skeleton className="mt-3 h-4 w-2/3" />
          <Skeleton className="mt-1.5 h-3 w-1/2" />
          <Skeleton className="mt-2 h-8 w-full" />
          <Skeleton className="mt-3 h-7 w-full" />
        </div>
      ))}
    </div>
  );
}
