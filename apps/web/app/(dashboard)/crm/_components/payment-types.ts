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

export type PaymentReceipt = {
  receiptTitle: string;
  company: { name: string; tagline: string };
  customer: {
    id: string;
    personName: string;
    companyName: string | null;
    phone: string | null;
    email: string | null;
    city: string | null;
    address: string | null;
  };
  contract: {
    title: string;
    agreedPrice: number;
    advancePayment: number;
    remainingBalance: number;
    agreedTerms: string | null;
  } | null;
  payment: {
    id: string;
    paymentNumber: string;
    amount: number;
    paidAt: string;
    createdAt: string;
    method: string | null;
    methodLabel?: string | null;
    verification: string;
    invoiceNumber: string | null;
    recordedByName: string | null;
  };
  generatedAt: string;
};
