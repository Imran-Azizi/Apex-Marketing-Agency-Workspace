export type SalesAssistantPriority = "HIGH" | "MEDIUM" | "LOW";
export type SalesAssistantActionState =
  | "NEW"
  | "VIEWED"
  | "IN_PROGRESS"
  | "DONE"
  | "DISMISSED";

export type SalesAssistantSection = "urgent" | "followUp" | "opportunity";

export interface SalesAssistantRecommendation {
  id: string;
  kind: string;
  kindLabel: string;
  category: string;
  priority: SalesAssistantPriority;
  priorityLabel: string;
  actionState: SalesAssistantActionState;
  section?: SalesAssistantSection;
  title: string;
  reason: string;
  whatHappened?: string | null;
  customerWants?: string | null;
  whatsStopping?: string | null;
  recommendedAction: string;
  suggestedMessage?: string | null;
  suggestedFollowUp?: string | null;
  pipelineStage: string;
  pipelineStageLabel: string;
  daysInStage?: number | null;
  usedAi: boolean;
  createdAt: string;
  customer?: {
    id: string;
    customerCode: string;
    personName: string;
    companyName?: string | null;
    displayName?: string;
    pipelineStage: string;
    lastContactAt?: string | null;
  } | null;
  salesOwner?: { id: string; fullName: string } | null;
}

export interface SalesAssistantInbox {
  items: SalesAssistantRecommendation[];
  total: number;
  page: number;
  pageSize: number;
  stats: {
    open: number;
    high: number;
    newCount: number;
    urgent: number;
    followUp: number;
    opportunity: number;
  };
}

export const PRIORITY_LABELS: Record<SalesAssistantPriority, string> = {
  HIGH: "بالا",
  MEDIUM: "متوسط",
  LOW: "پایین",
};

export function formatCount(value: number | null | undefined): string {
  return Number(value || 0).toLocaleString("en-US");
}

export function customerLabel(rec: SalesAssistantRecommendation): string {
  return (
    rec.customer?.displayName ||
    [rec.customer?.personName, rec.customer?.companyName]
      .filter(Boolean)
      .join(" — ") ||
    "مشتری"
  );
}
