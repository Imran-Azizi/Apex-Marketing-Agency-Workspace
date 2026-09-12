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

test("salesContactVisibility does not restrict Sales users", () => {
  assert.equal(
    salesContactVisibility({ roleCode: "SALES", userId: "sales-1" }),
    null,
  );
});

test("withContactVisibility leaves sales queries unchanged", () => {
  const where = { deletedAt: null };
  assert.deepEqual(
    withContactVisibility(where, {
      roleCode: "SALES",
      userId: "sales-1",
    }),
    where,
  );
});

test("withContactVisibility leaves manager queries unchanged", () => {
  const where = { deletedAt: null };
  assert.deepEqual(
    withContactVisibility(where, { roleCode: "MANAGER", userId: "m1" }),
    where,
  );
});
