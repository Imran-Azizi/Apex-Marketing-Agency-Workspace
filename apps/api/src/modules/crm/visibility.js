/**
 * Customer list visibility — CRM sales pipeline vs customer management (مشتریان ما).
 */

import {
  canonicalizeStage,
  isActiveInManagement,
  MANAGEMENT_INACTIVE_STAGES,
} from './pipeline.js';
import { normalizeCustomerCodeQuery } from './customerCode.js';

const MANAGEMENT_INACTIVE_SET = new Set(MANAGEMENT_INACTIVE_STAGES);

/**
 * Prisma `where` fragment for the customer search box (name, company, code, phone).
 * Shared by مدیریت مشتری and the project customer picker so both find the same rows.
 * @returns {object|null}
 */
export function customerSearchCondition(q) {
  const trimmed = String(q || '').trim();
  if (!trimmed) return null;
  const digits = trimmed.replace(/\D/g, '');
  const code = normalizeCustomerCodeQuery(trimmed);
  const or = [
    { personName: { contains: trimmed, mode: 'insensitive' } },
    { companyName: { contains: trimmed, mode: 'insensitive' } },
    { customerCode: { contains: code, mode: 'insensitive' } },
    { source: { contains: trimmed, mode: 'insensitive' } },
    { salesOwner: { fullName: { contains: trimmed, mode: 'insensitive' } } },
  ];
  if (digits) {
    or.push({ normalizedWhatsapp: { contains: digits } });
    or.push({ phone: { contains: digits } });
    or.push({ whatsappRaw: { contains: digits } });
  }
  return { OR: or };
}

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
