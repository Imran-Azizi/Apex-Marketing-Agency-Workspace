import { CATEGORIES, KINDS, PRIORITIES } from './constants.js';

export function categoryForKind(kind) {
  if (kind === KINDS.DEPOSIT_FOLLOW_UP) return CATEGORIES.DEPOSIT;
  if (kind === KINDS.REPEAT_ORDER) return CATEGORIES.REPEAT;
  return CATEGORIES.DECISION;
}

export function assignPriority(signal, context, settings = {}) {
  if (signal.kind === KINDS.DEPOSIT_FOLLOW_UP) return PRIORITIES.HIGH;
  if (signal.kind === KINDS.FOLLOW_UP) {
    const days = Number(context.daysInStage) || 0;
    const threshold = Number(settings.decisionWaitingDays) || 2;
    if (days >= threshold + 2) return PRIORITIES.HIGH;
    return PRIORITIES.MEDIUM;
  }
  if (signal.kind === KINDS.REPEAT_ORDER) {
    const orders = Number(context.orders?.deliveredCount) || 0;
    const minHigh = Number(settings.highValueMinOrders) || 2;
    return orders >= minHigh ? PRIORITIES.MEDIUM : PRIORITIES.LOW;
  }
  return PRIORITIES.MEDIUM;
}
