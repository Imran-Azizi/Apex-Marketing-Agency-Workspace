import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";

export function CustomerDetailSkeleton() {
  return (
    <div className="mx-auto max-w-7xl space-y-4 pb-10">
      <Card className="overflow-hidden">
        <Skeleton className="h-1 w-full" />
        <CardContent className="space-y-3 p-4 sm:p-5">
          <div className="flex items-center gap-3">
            <Skeleton className="h-12 w-12 rounded-xl" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-6 w-40" />
              <Skeleton className="h-4 w-56" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2 lg:grid-cols-5">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full rounded-xl" />
            ))}
          </div>
        </CardContent>
      </Card>

      <Skeleton className="h-12 w-full rounded-xl" />
      <Skeleton className="h-72 w-full rounded-xl" />
    </div>
  );
}
