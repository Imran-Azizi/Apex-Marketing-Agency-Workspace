export type BusinessAssistantPriority = "HIGH" | "MEDIUM" | "LOW";

export interface BriefingAction {
  title?: string;
  what: string;
  why?: string;
  problemOrOpportunity?: string;
  impact?: string;
  priority?: BusinessAssistantPriority;
  timeframe?: string;
}

export interface BriefingKpis {
  received: number;
  previousReceived: number;
  netProfit: number;
  previousNetProfit: number;
  receivable: number;
  newCustomers: number;
  previousNewCustomers: number;
  activeProjects: number;
  overdueProjects: number;
  completedThisMonth: number;
  stuckInPipeline: number;
  followUpsDue: number;
  contactMessagesThisMonth: number;
  portfolioPublished: number;
  teamSize: number;
  projectsPerPerson: number;
  trends?: {
    revenuePct?: number;
    netProfitPct?: number;
    newCustomersPct?: number;
  };
}

export interface BusinessBriefingPayload {
  generatedAt: string;
  usedAi: boolean;
  insufficientData: boolean;
  kpis: BriefingKpis;
  pipeline: Array<{ stage: string; count: number; label?: string }>;
  briefing: {
    overview: string;
    goingWell: string[];
    needsAttention: string[];
    strengths: string[];
    weaknesses: string[];
    opportunities: string[];
    weeklyStrategy: {
      summary?: string;
      problems?: string[];
      opportunities?: string[];
      priorities?: string[];
      marketing?: string[];
      sales?: string[];
      customers?: string[];
      operations?: string[];
      employees?: string[];
      tasks?: BriefingAction[];
    };
    monthlyStrategy: {
      overview?: string;
      strengths?: string[];
      weaknesses?: string[];
      growthOpportunities?: string[];
      marketingStrategy?: string;
      salesStrategy?: string;
      customerGrowthStrategy?: string;
      revenueOpportunities?: string[];
      operationalImprovements?: string[];
      goals?: string[];
      actions?: BriefingAction[];
      kpis?: Array<{ label: string; target?: number | null; note?: string }>;
    };
    recommendedActions: BriefingAction[];
    dataNotes?: string | null;
  };
}

export interface ChatMessage {
  id: string;
  role: "USER" | "ASSISTANT";
  content: string;
  usedAi: boolean;
  createdAt: string;
}

export const PRIORITY_LABELS: Record<BusinessAssistantPriority, string> = {
  HIGH: "بالا",
  MEDIUM: "متوسط",
  LOW: "پایین",
};

export function formatTrendPct(value?: number | null) {
  if (value == null) return "—";
  const sign = value > 0 ? "+" : "";
  return `${sign}${value}%`;
}
