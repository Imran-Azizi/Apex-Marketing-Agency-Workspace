import test from "node:test";
import assert from "node:assert/strict";
import {
  canManagerSendToCustomer,
  canReleaseVersionForProduction,
  canToggleSectionConfirm,
  getManagerSectionConfirm,
  requiredSectionsConfirmed,
  withManagerSectionConfirm,
} from "../../src/services/contentVersionRules.js";

test("canManagerSendToCustomer allows draft with content", () => {
  assert.equal(
    canManagerSendToCustomer({
      status: "DRAFT",
      scenario: { title: "x" },
      isLocked: false,
      publishedToClient: false,
    }),
    true,
  );
});

test("canManagerSendToCustomer blocks locked APPROVED", () => {
  assert.equal(
    canManagerSendToCustomer({
      status: "APPROVED",
      scenario: { title: "x" },
      isLocked: true,
      publishedToClient: true,
    }),
    false,
  );
});

test("section confirm requires only present sections", () => {
  const version = {
    status: "DRAFT",
    scenario: { title: "s" },
    narration: { script: "n" },
    storyboard: null,
    extras: {
      managerSectionConfirm: {
        scenario: { confirmed: true, at: "2026-01-01T00:00:00.000Z" },
        narration: { confirmed: true, at: "2026-01-01T00:00:00.000Z" },
        storyboard: { confirmed: false },
      },
    },
  };
  assert.equal(requiredSectionsConfirmed(version), true);
  assert.equal(canReleaseVersionForProduction(version), true);
});

test("release blocked until all present sections confirmed", () => {
  const version = {
    status: "DRAFT",
    scenario: { title: "s" },
    narration: { script: "n" },
    storyboard: { scenes: [] },
    extras: {
      managerSectionConfirm: {
        scenario: { confirmed: true },
        narration: { confirmed: true },
        storyboard: { confirmed: false },
      },
    },
  };
  assert.equal(requiredSectionsConfirmed(version), false);
  assert.equal(canReleaseVersionForProduction(version), false);
});

test("cannot toggle confirm on locked approved version", () => {
  assert.equal(
    canToggleSectionConfirm({
      status: "APPROVED",
      isLocked: true,
      scenario: { title: "s" },
    }),
    false,
  );
});

test("withManagerSectionConfirm exposes normalized confirm state", () => {
  const row = withManagerSectionConfirm({
    id: "v1",
    status: "DRAFT",
    scenario: { title: "s" },
    extras: {
      managerSectionConfirm: {
        scenario: { confirmed: true, at: "t1", byUserId: "u1" },
        releasedAt: null,
      },
    },
  });
  assert.equal(row.managerSectionConfirm.scenario.confirmed, true);
  assert.equal(row.managerSectionConfirm.narration.confirmed, false);
  assert.equal(getManagerSectionConfirm(row).scenario.byUserId, "u1");
});
