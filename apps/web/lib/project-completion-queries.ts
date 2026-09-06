import type { QueryClient } from "@tanstack/react-query";
import { invalidateFinanceQueries } from "@/lib/finance-queries";

/**
 * After a project is marked COMPLETED, refresh every surface that reads
 * project status so Manager / Editor / Narrator / Portal / Finance / CRM
 * stay in sync without a manual browser refresh.
 */
export async function invalidateAfterProjectCompleted(
  queryClient: QueryClient,
  projectId: string,
) {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: ["project", projectId] }),
    queryClient.invalidateQueries({ queryKey: ["project"] }),
    queryClient.invalidateQueries({ queryKey: ["projects"] }),
    queryClient.invalidateQueries({ queryKey: ["projects-home"] }),
    queryClient.invalidateQueries({ queryKey: ["dashboard-summary"] }),
    queryClient.invalidateQueries({ queryKey: ["crm-customers"] }),
    queryClient.invalidateQueries({ queryKey: ["crm-customer"] }),
    queryClient.invalidateQueries({ queryKey: ["crm-dashboard"] }),
    queryClient.invalidateQueries({ queryKey: ["notifications"] }),
    queryClient.invalidateQueries({ queryKey: ["portal-project", projectId] }),
    queryClient.invalidateQueries({ queryKey: ["portal-project"] }),
    queryClient.invalidateQueries({ queryKey: ["portal-projects"] }),
    queryClient.invalidateQueries({ queryKey: ["portal-dashboard"] }),
    queryClient.invalidateQueries({ queryKey: ["editor-dashboard"] }),
    queryClient.invalidateQueries({ queryKey: ["editor-projects"] }),
    queryClient.invalidateQueries({ queryKey: ["editor-my-tasks-home"] }),
    queryClient.invalidateQueries({ queryKey: ["narrator-dashboard"] }),
    queryClient.invalidateQueries({ queryKey: ["narration-my-tasks"] }),
    queryClient.invalidateQueries({ queryKey: ["narration-task", projectId] }),
    queryClient.invalidateQueries({ queryKey: ["narrator-workspace", projectId] }),
    queryClient.invalidateQueries({ queryKey: ["portfolio-project", projectId] }),
    invalidateFinanceQueries(queryClient),
  ]);
}

/** Patch open project detail caches so the UI flips to COMPLETED immediately. */
export function patchProjectCompletedInCache(
  queryClient: QueryClient,
  projectId: string,
  completedAt?: string | null,
) {
  const at = completedAt || new Date().toISOString();
  queryClient.setQueriesData(
    { queryKey: ["project", projectId] },
    (prev: unknown) => {
      if (!prev || typeof prev !== "object" || Array.isArray(prev)) return prev;
      return {
        ...(prev as Record<string, unknown>),
        status: "COMPLETED",
        customerFacingStatus: "COMPLETED",
        completedAt: at,
        deliveryStatus: "COMPLETED",
      };
    },
  );
}
