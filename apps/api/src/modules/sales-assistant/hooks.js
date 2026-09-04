/**
 * Debounced CRM event hook → re-evaluate one customer.
 */

const pending = new Map();

export function scheduleSalesAssistantReeval(customerId, eventType = 'CRM_EVENT') {
  if (!customerId) return;
  const key = String(customerId);
  if (pending.has(key)) return;
  pending.set(key, true);
  setTimeout(async () => {
    pending.delete(key);
    try {
      const { evaluateCustomer } = await import('./engine.js');
      await evaluateCustomer(customerId, {
        trigger: 'CRM_EVENT',
        eventType,
      });
    } catch (err) {
      console.error('[sales-assistant] reeval failed', customerId, err?.message || err);
    }
  }, 1500);
}
