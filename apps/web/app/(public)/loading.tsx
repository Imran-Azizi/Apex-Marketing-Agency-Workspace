import { CardSkeleton } from "@/components/loading/skeletons";
import { Skeleton } from "@/components/ui/skeleton";

export default function PublicLoading() {
  return (
    <div className="mx-auto max-w-7xl animate-fade-slide space-y-8 px-4 py-12 sm:px-6 lg:px-8">
      <div className="space-y-4 text-center">
        <Skeleton className="mx-auto h-10 w-96 max-w-full" />
        <Skeleton className="mx-auto h-5 w-72 max-w-full" />
        <Skeleton className="mx-auto h-11 w-40" />
      </div>
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <CardSkeleton key={i} lines={3} />
        ))}
      </div>
    </div>
  );
}
