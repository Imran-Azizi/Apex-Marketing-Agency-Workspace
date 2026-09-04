/** Primary customer/contact name — person first, company only when person is empty. */
export function getCustomerPersonName(customer, fallback = 'مشتری') {
  const person = String(customer?.personName || '').trim();
  if (person) return person;
  const company = String(customer?.companyName || '').trim();
  return company || fallback;
}

/** Company / brand name only. */
export function getCustomerCompanyName(customer) {
  const company = String(customer?.companyName || '').trim();
  return company || null;
}

/** Person with optional company suffix for compact labels (notifications, titles). */
export function formatCustomerNameWithCompany(customer, fallback = 'مشتری') {
  const person = String(customer?.personName || '').trim();
  const company = String(customer?.companyName || '').trim();
  if (person && company) return `${person} — ${company}`;
  return person || company || fallback;
}
