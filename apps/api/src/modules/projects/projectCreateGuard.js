import { AppError } from "../../utils/response.js";

/** In-process coalescing so concurrent identical keys share one create. */
const inFlightByKey = new Map();

export function normalizeIdempotencyKey(value) {
  const key = String(value || "").trim();
  if (!key) return null;
  if (key.length < 8 || key.length > 80 || !/^[A-Za-z0-9_-]+$/.test(key)) {
    throw new AppError("کلید ارسال نامعتبر است", 400, "VALIDATION");
  }
  return key;
}

export function isIdempotencyUniqueConflict(err) {
  if (!err) return false;
  if (err.code === "P2002") {
    const target = err.meta?.target;
    if (Array.isArray(target)) return target.includes("createIdempotencyKey");
    if (typeof target === "string") return target.includes("createIdempotencyKey");
  }
  const message = `${err.message || ""} ${err.meta?.message || ""} ${err.meta?.code || ""}`;
  return (
    message.includes("createIdempotencyKey") ||
    message.includes("projects_createIdempotencyKey_key")
  );
}

export async function findProjectByCreateKey(db, key, crmCustomerId) {
  if (!key) return null;
  const rows = await db.$queryRaw`
    SELECT id, "crmCustomerId"
    FROM "projects"
    WHERE "createIdempotencyKey" = ${key}
      AND "deletedAt" IS NULL
    LIMIT 1
  `;
  const row = Array.isArray(rows) ? rows[0] : null;
  if (!row) return null;
  if (crmCustomerId && row.crmCustomerId !== crmCustomerId) {
    throw new AppError("کلید ارسال نامعتبر است", 409, "IDEMPOTENCY_CONFLICT");
  }
  return db.project.findFirst({
    where: { id: row.id, deletedAt: null },
  });
}

export async function findProjectForOpportunity(db, opportunityId) {
  if (!opportunityId) return null;
  const opp = await db.opportunity.findFirst({
    where: { id: opportunityId, deletedAt: null },
    select: { projectId: true },
  });
  if (!opp?.projectId) return null;
  return db.project.findFirst({
    where: { id: opp.projectId, deletedAt: null },
  });
}

/**
 * Serialize creates that attach to the same CRM opportunity.
 * Without this, two in-flight requests can both see projectId=null and
 * insert two projects, then overwrite opportunity.projectId.
 */
export async function lockOpportunityRow(tx, opportunityId) {
  const rows = await tx.$queryRaw`
    SELECT id, "projectId"
    FROM "opportunities"
    WHERE id = ${opportunityId}
      AND "deletedAt" IS NULL
    FOR UPDATE
  `;
  if (!Array.isArray(rows) || !rows.length) {
    throw new AppError("فرصت یافت نشد", 404, "NOT_FOUND");
  }
  return rows[0];
}

export async function withProjectCreateLock(key, fn) {
  if (!key) return fn();
  const existing = inFlightByKey.get(key);
  if (existing) return existing;
  const work = fn();
  inFlightByKey.set(key, work);
  try {
    return await work;
  } finally {
    if (inFlightByKey.get(key) === work) {
      inFlightByKey.delete(key);
    }
  }
}
