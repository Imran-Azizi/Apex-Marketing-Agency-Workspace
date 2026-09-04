export interface CrmAllowedActions {
  view: boolean;
  edit: boolean;
  recordCustomerInfo: boolean;
  addNote: boolean;
  addInteraction: boolean;
  changeStatus: boolean;
  createInvoice: boolean;
  createCustomer: boolean;
  transferToManagement: boolean;
  viewCustomer: boolean;
  viewProject: boolean;
  viewPayment: boolean;
  viewInvoice: boolean;
  invitePortal: boolean;
  markRepeatCustomer?: boolean;
  createNewProject?: boolean;
  assign: boolean;
}

export interface CrmCustomer {
  id: string;
  customerCode?: string;
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
  pipelineStage?: string;
  pipelineStageLabel?: string;
  stageControl?: string;
  category?: string | null;
  categoryLabel?: string | null;
  convertedAt?: string | null;
  isConverted?: boolean;
  isActiveInManagement?: boolean;
  lastContactAt?: string | null;
  nextFollowUpAt: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  orderAmount?: number | null;
  paymentStatus?: string | null;
  allowedActions?: CrmAllowedActions;
  salesOwner: { id: string; fullName: string } | null;
}

export interface CrmListResponse {
  items: CrmCustomer[];
  total: number;
  page: number;
  pageSize: number;
}

export interface CrmTransferResult {
  selected: number;
  transferred: Array<{ id: string; personName: string | null; customerCode: string | null }>;
  alreadyTransferred: Array<{ id: string; personName: string | null; customerCode: string | null }>;
  skipped: Array<{ id: string; personName: string | null; customerCode: string | null; reason?: string }>;
  failed: Array<{ id: string; personName: string | null; customerCode: string | null; message?: string }>;
}

export interface CrmFormOptions {
  leadSources: Array<{ code: string; label: string }>;
  salesReps: Array<{ id: string; fullName: string; roleCode: string }>;
  stages?: Array<{ code: string; label: string }>;
  categories?: Array<{ code: string; label: string }>;
  paymentMethods?: Array<{ code: string; label: string }>;
}

export interface CrmDashboardStats {
  total: number;
  stages: Record<string, number>;
  categories: {
    GHOST: number;
    INTERESTED: number;
    FOLLOW_UP: number;
    OUR_CUSTOMERS: number;
  };
}
