/**
 * Sales CRM access helpers.
 *
 * Business rule: Sales users with CRM permissions may list and open all
 * non-deleted CRM customers (same pool as managers for visibility).
 * Write/transfer actions remain gated by crm.* permissions.
 */

export function salesCustomerListFilter(_auth) {
  return null;
}

export function assertSalesCustomerListOwnerFilter(_salesOwnerId, _auth) {
  // Sales may filter by any owner; no ownership restriction.
}

export function assertSalesCustomerAccess(_customer, _auth) {
  // Sales may open any CRM customer they can list.
}
