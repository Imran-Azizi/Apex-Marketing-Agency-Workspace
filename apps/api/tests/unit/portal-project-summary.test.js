import test from "node:test";
import assert from "node:assert/strict";
import { serializePortalProjectSummary } from "../../src/modules/portal/helpers.js";

const base = {
  id: "p1",
  code: "APX-2026-0001",
  title: "Video",
  status: "NEW_MANAGER_REVIEW",
  customerFacingStatus: "INFO_RECEIVED",
};

test("portal summary shows the price of a single-video project", () => {
  const row = serializePortalProjectSummary({
    ...base,
    kind: "SINGLE",
    finance: { finalProjectPrice: "2500" },
  });
  assert.equal(row.budget, 2500);
});

test("portal summary hides the zero price of an unpriced contract video", () => {
  const row = serializePortalProjectSummary({
    ...base,
    kind: "CHILD",
    finance: { finalProjectPrice: "0" },
  });
  assert.equal(row.budget, null);
});

test("portal summary keeps an explicitly priced contract video", () => {
  const row = serializePortalProjectSummary({
    ...base,
    kind: "CHILD",
    finance: { finalProjectPrice: "800" },
  });
  assert.equal(row.budget, 800);
});
