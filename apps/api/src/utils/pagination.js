import { SECURITY } from "../config/security.js";

/**
 * Clamp page/limit from untrusted query params.
 * @param {Record<string, unknown>} query
 * @param {{ defaultPageSize?: number, maxPageSize?: number }} [opts]
 */
export function parsePagination(query = {}, opts = {}) {
  const defaultPageSize = opts.defaultPageSize ?? SECURITY.pagination.defaultPageSize;
  const maxPageSize = opts.maxPageSize ?? SECURITY.pagination.maxPageSize;

  let page = Number.parseInt(String(query.page ?? 1), 10);
  if (!Number.isFinite(page) || page < 1) page = 1;
  page = Math.min(page, 1_000_000);

  const rawSize = query.pageSize ?? query.limit ?? defaultPageSize;
  let pageSize = Number.parseInt(String(rawSize), 10);
  if (!Number.isFinite(pageSize) || pageSize < 1) pageSize = defaultPageSize;
  pageSize = Math.min(maxPageSize, pageSize);

  return {
    page,
    pageSize,
    skip: (page - 1) * pageSize,
    take: pageSize,
  };
}
