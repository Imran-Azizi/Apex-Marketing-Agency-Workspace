import { AppError } from '../../utils/response.js';

/** Prisma filter: SALES users see their own leads plus unassigned pool. */
export function salesCustomerListFilter(auth) {
  if (String(auth?.roleCode || '').toUpperCase() !== 'SALES') return null;
  return {
    OR: [{ salesOwnerId: auth.userId }, { salesOwnerId: null }],
  };
}

export function assertSalesCustomerListOwnerFilter(salesOwnerId, auth) {
  if (String(auth?.roleCode || '').toUpperCase() !== 'SALES') return;
  if (salesOwnerId && salesOwnerId !== auth.userId) {
    throw new AppError(
      'فقط سرنخ‌های اختصاص‌یافته به شما قابل مشاهده است',
      403,
      'FORBIDDEN',
    );
  }
}

export function assertSalesCustomerAccess(customer, auth) {
  if (String(auth?.roleCode || '').toUpperCase() !== 'SALES') return;
  if (customer?.salesOwnerId && customer.salesOwnerId !== auth.userId) {
    throw new AppError('دسترسی به این مشتری مجاز نیست', 403, 'FORBIDDEN');
  }
}
