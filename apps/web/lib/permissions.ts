"use client";

import { usePathname } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { getMe } from "@/lib/auth";
import { resolveClientAuthPanel } from "@/lib/auth-panel";
import { hasPermission } from "@/lib/rbac";

export function useMeQuery() {
  const pathname = usePathname();
  const panel = resolveClientAuthPanel(pathname);
  return useQuery({
    queryKey: ["me", panel || "internal"],
    queryFn: getMe,
    retry: false,
    staleTime: 5 * 60_000,
    refetchOnWindowFocus: false,
  });
}

export function useHasPermission(code: string | string[]): boolean {
  const { data: me } = useMeQuery();
  return hasPermission(me?.permissions, code, me?.role);
}
