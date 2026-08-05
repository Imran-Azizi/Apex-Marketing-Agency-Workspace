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
}

export interface CrmListResponse {
  items: CrmCustomer[];
  total: number;
  page: number;
  pageSize: number;
}

export interface CrmFormOptions {
  leadSources: Array<{ code: string; label: string }>;
  salesReps: Array<{ id: string; fullName: string; roleCode: string }>;
}
