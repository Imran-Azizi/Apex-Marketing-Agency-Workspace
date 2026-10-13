export interface CrmCustomer {
  id: string;
  personName: string;
  companyName: string | null;
  jobTitle: string | null;
  phone: string | null;
  whatsappRaw: string;
  normalizedWhatsapp: string;
  city: string | null;
  address: string | null;
  email: string | null;
  source: string | null;
  salesOwnerId?: string | null;
  portalStatus: string;
  nextFollowUpAt: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  salesOwner: { id: string; fullName: string } | null;
  pipelineStage?: string;
  pipelineStageLabel?: string;
  activeContract?: CrmContractSummary | null;
}

/** Multi-video contract scope captured in the contract creation wizard. */
export interface CrmContractSummary {
  projectId: string;
  code: string;
  title: string;
  status: string;
  createdAt: string;
  videoCount: number | null;
  posterCount: number | null;
  startDate: string | null;
  endDate: string | null;
  opportunityId: string | null;
  agreedPrice: number | null;
  agreedTerms: string | null;
  contractLocked: boolean;
}

export interface CrmListResponse {
  items: CrmCustomer[];
  total: number;
  page: number;
  pageSize: number;
  totalPages?: number;
}

export interface CrmFormOptions {
  leadSources: Array<{ code: string; label: string }>;
  salesReps: Array<{ id: string; fullName: string; roleCode: string }>;
}
