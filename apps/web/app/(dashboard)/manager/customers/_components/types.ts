import type { ShowcaseCustomer } from "@/lib/customers";

export type CustomerStatusFilter = "ALL" | "active" | "inactive";

export type CustomerStats = {
  total: number;
  published: number;
  unpublished: number;
};

export type { ShowcaseCustomer };
