import test from "node:test";
import assert from "node:assert/strict";
import {
  salesContactVisibility,
  withContactVisibility,
} from "../../src/modules/contact/visibility.js";

test("salesContactVisibility is null for managers", () => {
  assert.equal(
    salesContactVisibility({ roleCode: "MANAGER", userId: "u1" }),
    null,
  );
});

test("salesContactVisibility scopes to owned or unassigned CRM customers", () => {
  const vis = salesContactVisibility({ roleCode: "SALES", userId: "sales-1" });
  assert.deepEqual(vis, {
    OR: [
      { crmCustomerId: null },
      { crmCustomer: { salesOwnerId: "sales-1" } },
      { crmCustomer: { salesOwnerId: null } },
    ],
  });
});

test("withContactVisibility wraps filters for sales", () => {
  const where = withContactVisibility({ deletedAt: null }, {
    roleCode: "SALES",
    userId: "sales-1",
  });
  assert.equal(where.AND.length, 2);
  assert.deepEqual(where.AND[0], { deletedAt: null });
});

test("withContactVisibility leaves manager queries unchanged", () => {
  const where = { deletedAt: null };
  assert.deepEqual(
    withContactVisibility(where, { roleCode: "MANAGER", userId: "m1" }),
    where,
  );
});
