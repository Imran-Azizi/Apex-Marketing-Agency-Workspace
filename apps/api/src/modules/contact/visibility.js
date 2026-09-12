/**
 * Contact inbox visibility — aligned with CRM list: Sales sees the full
 * customer-linked message pool (no salesOwnerId restriction).
 */
export function salesContactVisibility(_auth) {
  return null;
}

export function withContactVisibility(where, auth) {
  const visibility = salesContactVisibility(auth);
  if (!visibility) return where;
  return { AND: [where, visibility] };
}
