import { isManagerRole } from "../crm/pipeline.js";

/**
 * Sales users may only see contact messages that are unlinked, or linked to
 * CRM customers they own or that are unassigned (same rule as CRM list).
 */
export function salesContactVisibility(auth) {
  if (!auth || isManagerRole(auth.roleCode)) return null;
  if (String(auth.roleCode || "").toUpperCase() !== "SALES") return null;
  return {
    OR: [
      { crmCustomerId: null },
      { crmCustomer: { salesOwnerId: auth.userId } },
      { crmCustomer: { salesOwnerId: null } },
    ],
  };
}

export function withContactVisibility(where, auth) {
  const visibility = salesContactVisibility(auth);
  if (!visibility) return where;
  return { AND: [where, visibility] };
}
