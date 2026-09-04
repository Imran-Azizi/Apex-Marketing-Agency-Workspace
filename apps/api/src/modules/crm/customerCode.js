const PREFIX = 'APEX-';

export async function allocateCustomerCode(tx) {
  const rows = await tx.$queryRaw`SELECT nextval('crm_customer_code_seq') AS n`;
  const n = Number(rows?.[0]?.n || rows?.[0]?.N || 0);
  if (!Number.isFinite(n) || n <= 0) {
    const fallback = Date.now().toString(36).toUpperCase();
    return `${PREFIX}${fallback}`;
  }
  return `${PREFIX}${String(n).padStart(5, '0')}`;
}

export function isCustomerCodeQuery(value) {
  const raw = String(value || '').trim().toUpperCase();
  return /^APEX-?\d+$/i.test(raw) || /^APEX-[A-Z0-9]+$/i.test(raw);
}

export function normalizeCustomerCodeQuery(value) {
  const raw = String(value || '').trim().toUpperCase().replace(/\s+/g, '');
  if (/^APEX\d+$/.test(raw)) return `APEX-${raw.slice(4)}`;
  return raw;
}
