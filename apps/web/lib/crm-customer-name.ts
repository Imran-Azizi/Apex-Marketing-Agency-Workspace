export type CrmCustomerNameFields = {
  personName?: string | null;
  companyName?: string | null;
};

/** Primary customer/contact name — person first, company only when person is empty. */
export function getCustomerPersonName(
  customer?: CrmCustomerNameFields | null,
  fallback = "—",
): string {
  const person = customer?.personName?.trim();
  if (person) return person;
  const company = customer?.companyName?.trim();
  return company || fallback;
}

/** Company / brand name only. */
export function getCustomerCompanyName(
  customer?: CrmCustomerNameFields | null,
): string | null {
  return customer?.companyName?.trim() || null;
}

/** CRM list pattern: person as primary label, company as optional secondary line. */
export function getCustomerListDisplay(
  customer?: CrmCustomerNameFields | null,
  fallback = "—",
): { primary: string; secondary: string | null } {
  const person = customer?.personName?.trim() || null;
  const company = customer?.companyName?.trim() || null;
  return {
    primary: person || company || fallback,
    secondary: person && company ? company : null,
  };
}
