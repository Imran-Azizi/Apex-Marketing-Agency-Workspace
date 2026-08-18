import { Skeleton } from "@/components/ui/skeleton";

export default function PortfolioWorkLoading() {
  return (
    <div dir="rtl" className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10 lg:px-8 lg:py-12">
      <Skeleton className="mb-8 h-4 w-64 max-w-full" />
      <Skeleton className="aspect-video w-full rounded-2xl" />
      <div className="mt-6 space-y-3">
        <Skeleton className="h-4 w-28" />
        <Skeleton className="h-8 w-3/4 max-w-xl" />
        <Skeleton className="h-16 w-full max-w-3xl" />
      </div>
      <div className="mt-12 grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div
            key={i}
            className="overflow-hidden rounded-2xl border border-border/70 bg-card"
          >
            <Skeleton className="aspect-video w-full rounded-none" />
            <div className="space-y-2 p-4">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-5 w-3/4" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
