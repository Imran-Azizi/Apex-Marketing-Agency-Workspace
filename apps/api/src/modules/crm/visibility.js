/**
 * Customer list visibility — CRM sales pipeline vs customer management (مشتریان ما).
 */

import {
  canonicalizeStage,
  isActiveInManagement,
  MANAGEMENT_INACTIVE_STAGES,
} from './pipeline.js';

const MANAGEMENT_INACTIVE_SET = new Set(MANAGEMENT_INACTIVE_STAGES);

/**
 * Prisma `where` fragment for `/crm/customers?scope=…`.
 * Management = customers transferred from CRM و فروش, excluding delivered projects.
 * @returns {object|null}
 */
export function customerListScopeCondition(scope) {
  const normalized = String(scope || '').toLowerCase();
  if (normalized === 'management') {
    return {
      AND: [
        { convertedAt: { not: null } },
        { pipelineStage: { notIn: [...MANAGEMENT_INACTIVE_STAGES] } },
      ],
    };
  }
  // pipeline (and default): all customers regardless of conversion or stage
  return null;
}

/**
 * Whether a customer belongs on the management list (مدیریت مشتری).
 */
export function isActiveManagementCustomer(customer) {
  if (!customer?.convertedAt) return false;
  const stage = canonicalizeStage(customer.pipelineStage);
  return !MANAGEMENT_INACTIVE_SET.has(stage);
}

/**
 * @deprecated Prefer isActiveManagementCustomer for list membership.
 * Kept for category badge logic tied to OUR_CUSTOMERS.
 */
export function isActiveManagementCustomerLegacy(customer) {
  return isActiveInManagement(customer);
}
