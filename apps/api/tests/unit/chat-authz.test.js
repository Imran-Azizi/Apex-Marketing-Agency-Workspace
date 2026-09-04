import test from "node:test";
import assert from "node:assert/strict";

/**
 * Pure policy evaluation mirroring chat/authz.js employee-to-employee rules.
 * Kept local so unit tests do not require a live database.
 */
function evaluateEmployeePolicy({
  actorRole,
  targetRole,
  policy,
  sameTeam,
  selectedPair,
}) {
  const managers = new Set(["MANAGER", "ADMIN"]);
  const employees = new Set(["SALES", "EDITOR", "NARRATOR", "FINANCE", "PROJECT_MANAGER"]);

  if (managers.has(actorRole) || managers.has(targetRole)) {
    return { allowed: true, reason: "MANAGER_CHANNEL" };
  }
  if (!employees.has(actorRole) || !employees.has(targetRole)) {
    return { allowed: false, reason: "ROLE_NOT_SUPPORTED" };
  }
  if (policy === "DISABLED") {
    return { allowed: false, reason: "EMPLOYEE_CHAT_DISABLED" };
  }
  if (policy === "ALL_EMPLOYEES") {
    return { allowed: true, reason: "POLICY_ALL" };
  }
  if (policy === "SAME_TEAM") {
    return sameTeam
      ? { allowed: true, reason: "POLICY_SAME_TEAM" }
      : { allowed: false, reason: "DIFFERENT_TEAM" };
  }
  if (policy === "SELECTED") {
    return selectedPair
      ? { allowed: true, reason: "POLICY_SELECTED" }
      : { allowed: false, reason: "NOT_IN_ALLOW_LIST" };
  }
  return { allowed: false, reason: "EMPLOYEE_CHAT_DISABLED" };
}

test("manager can always message employee", () => {
  const result = evaluateEmployeePolicy({
    actorRole: "MANAGER",
    targetRole: "EDITOR",
    policy: "DISABLED",
  });
  assert.equal(result.allowed, true);
});

test("employee can always message manager even when E2E disabled", () => {
  const result = evaluateEmployeePolicy({
    actorRole: "SALES",
    targetRole: "ADMIN",
    policy: "DISABLED",
  });
  assert.equal(result.allowed, true);
});

test("employee-to-employee blocked when policy DISABLED (default)", () => {
  const result = evaluateEmployeePolicy({
    actorRole: "EDITOR",
    targetRole: "NARRATOR",
    policy: "DISABLED",
  });
  assert.equal(result.allowed, false);
  assert.equal(result.reason, "EMPLOYEE_CHAT_DISABLED");
});

test("employee-to-employee allowed when ALL_EMPLOYEES", () => {
  const result = evaluateEmployeePolicy({
    actorRole: "EDITOR",
    targetRole: "SALES",
    policy: "ALL_EMPLOYEES",
  });
  assert.equal(result.allowed, true);
});

test("SAME_TEAM requires matching team", () => {
  assert.equal(
    evaluateEmployeePolicy({
      actorRole: "EDITOR",
      targetRole: "EDITOR",
      policy: "SAME_TEAM",
      sameTeam: true,
    }).allowed,
    true,
  );
  assert.equal(
    evaluateEmployeePolicy({
      actorRole: "EDITOR",
      targetRole: "NARRATOR",
      policy: "SAME_TEAM",
      sameTeam: false,
    }).allowed,
    false,
  );
});

test("SELECTED requires allow-list pair", () => {
  assert.equal(
    evaluateEmployeePolicy({
      actorRole: "SALES",
      targetRole: "FINANCE",
      policy: "SELECTED",
      selectedPair: false,
    }).allowed,
    false,
  );
  assert.equal(
    evaluateEmployeePolicy({
      actorRole: "SALES",
      targetRole: "FINANCE",
      policy: "SELECTED",
      selectedPair: true,
    }).allowed,
    true,
  );
});

test("IDOR-style self chat is not a manager bypass path", () => {
  // Self is rejected before policy in authz; here we only assert E2E still gated.
  const result = evaluateEmployeePolicy({
    actorRole: "EDITOR",
    targetRole: "EDITOR",
    policy: "DISABLED",
  });
  assert.equal(result.allowed, false);
});
