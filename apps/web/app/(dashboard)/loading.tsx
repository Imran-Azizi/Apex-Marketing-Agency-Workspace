import { DashboardSkeleton } from "@/components/loading/skeletons";
import { LoadingTable } from "@/components/shared/loading-table";

export default function DashboardLoading() {
  return (
    <div className="space-y-6 animate-fade-slide">
      <DashboardSkeleton />
      <LoadingTable columns={5} rows={5} />
    </div>
  );
}
