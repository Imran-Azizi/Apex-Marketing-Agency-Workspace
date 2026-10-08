export type ProjectKind = "SINGLE" | "CONTRACT" | "CHILD";

export type ContractVideoStats = {
  total: number;
  completed: number;
  inProgress: number;
  pending: number;
  canceled: number;
  progressPercent: number;
};

export function formatCount(value: number): string {
  return value.toLocaleString("fa-AF", { numberingSystem: "latn" });
}
