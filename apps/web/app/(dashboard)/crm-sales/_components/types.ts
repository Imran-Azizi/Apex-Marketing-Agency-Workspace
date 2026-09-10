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

export type CrmInvoiceStatus =
  | "DRAFT"
  | "ISSUED"
  | "PARTIALLY_PAID"
  | "PAID"
  | "OVERDUE"
  | "CANCELED";

export interface CrmInvoiceCustomer {
  id: string;
  customerCode?: string | null;
  personName?: string | null;
  companyName?: string | null;
  phone?: string | null;
  whatsappRaw?: string | null;
  email?: string | null;
}

export interface CrmInvoiceItem {
  id?: string;
  description: string;
  quantity: string | number;
  unitPrice: string | number;
  amount: string | number;
}

export interface CrmInvoice {
  id: string;
  invoiceNumber: string;
  status: CrmInvoiceStatus | string;
  total: string | number;
  subtotal?: string | number;
  paidAmount?: number;
  remainingAmount?: number;
  videoCount?: number | null;
  notes?: string | null;
  issuedAt?: string | null;
  createdAt?: string;
  paymentMethod?: string | null;
  paymentMethodLabel?: string | null;
  paymentMethodMeta?: Record<string, string> | null;
  paymentMethodMetaRows?: Array<{ label: string; value: string; ltr?: boolean }>;
  isCrmInvoice?: boolean;
  paymentId?: string | null;
  recordedByName?: string | null;
  statusLabel?: string | null;
  customerId?: string;
  items?: CrmInvoiceItem[];
  customer?: CrmInvoiceCustomer;
  company?: {
    name?: string | null;
    phone?: string | null;
    email?: string | null;
    website?: string | null;
  };
}

export interface CrmInvoiceListResponse {
  customer: CrmInvoiceCustomer;
  items: CrmInvoice[];
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
  totalPages?: number;
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
