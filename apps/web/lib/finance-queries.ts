import type { QueryClient } from "@tanstack/react-query";

/** Invalidate all finance KPI / P&L caches after money-related mutations. */
export function invalidateFinanceQueries(queryClient: QueryClient) {
  return Promise.all([
    queryClient.invalidateQueries({ queryKey: ["finance-dashboard"] }),
    queryClient.invalidateQueries({ queryKey: ["finance-pnl"] }),
    queryClient.invalidateQueries({ queryKey: ["finance-projects"] }),
  ]);
}
