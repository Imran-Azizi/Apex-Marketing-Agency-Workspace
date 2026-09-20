export type CustomerInvoice = {
  id: string;
  invoiceNumber: string;
  total: string;
  status: string;
  opportunityId?: string | null;
};

export type CustomerPayment = {
  id: string;
  amount: string;
  verification: string;
  invoiceId: string | null;
  createdAt: string;
  paidAt?: string;
  reference?: string | null;
  method?: string | null;
  methodLabel?: string | null;
  notes?: string | null;
  rejectionReason?: string | null;
  rejectedAt?: string | null;
  verifiedAt?: string | null;
  recordedBy?: { id: string; fullName: string } | null;
  invoice?: { id: string; invoiceNumber: string } | null;
};

export type PaymentMethodMetaRow = {
  label: string;
  value: string;
  ltr?: boolean;
};

export type PaymentReceiptFinance = {
  totalAmount: number;
  previouslyPaid: number;
  currentPayment: number;
  totalPaid: number;
  remainingBalance: number;
};

export type PaymentReceipt = {
  receiptTitle: string;
  company: {
    name: string;
    tagline: string;
    phone?: string | null;
    email?: string | null;
    website?: string | null;
  };
  customer: {
    id: string;
    customerCode?: string | null;
    personName: string;
    companyName: string | null;
    phone: string | null;
    email: string | null;
    city: string | null;
    address: string | null;
  };
  contract: {
    id?: string;
    title: string;
    agreedPrice: number;
    advancePayment: number;
    remainingBalance: number;
    agreedTerms: string | null;
  } | null;
  invoice: {
    id: string;
    invoiceNumber: string;
    projectReference: string | null;
    total: number;
    previouslyPaid: number;
    currentPayment: number;
    totalPaid: number;
    remaining: number;
    status: string;
    statusLabel: string;
    issuedAt: string;
    notes: string | null;
  } | null;
  finance: PaymentReceiptFinance;
  payment: {
    id: string;
    paymentNumber: string;
    amount: number;
    paidAt: string;
    createdAt: string;
    method: string | null;
    methodLabel?: string | null;
    methodMetaRows?: PaymentMethodMetaRow[];
    reference?: string | null;
    notes?: string | null;
    verification: string;
    receiptStatus: string;
    receiptStatusLabel: string;
    invoiceId?: string | null;
    invoiceNumber: string | null;
    recordedByName: string | null;
  };
  generatedAt: string;
};
