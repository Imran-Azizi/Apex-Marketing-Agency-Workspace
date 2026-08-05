import {
  KpiCardSkeletonGrid,
  PageHeaderSkeleton,
} from "@/components/loading/skeletons";
import { Skeleton } from "@/components/ui/skeleton";

export default function PortalLoading() {
  return (
    <div dir="rtl" className="space-y-4 animate-fade-slide text-start">
      <Skeleton className="h-32 w-full rounded-2xl" />
      <KpiCardSkeletonGrid count={5} className="grid-cols-2 lg:grid-cols-5" />
      <Skeleton className="h-36 w-full rounded-2xl" />
      <div className="space-y-3 rounded-2xl border border-border/70 bg-card p-4">
        <PageHeaderSkeleton />
        <Skeleton className="h-40 w-full rounded-xl" />
      </div>
    </div>
  );
}
