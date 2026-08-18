import type { ContactSubject } from "@/lib/contact";

export type StatusFilter = "ALL" | "UNREAD" | "READ";
export type SortValue = "newest" | "oldest" | "name" | "status";
export type SubjectFilter = "ALL" | ContactSubject;

export function formatCount(value: number) {
  return value.toLocaleString("fa-AF", { numberingSystem: "latn" });
}
