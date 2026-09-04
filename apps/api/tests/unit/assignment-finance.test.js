import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  parseAssignmentAmount,
  resolveAssignmentAmount,
  teamProfileHasMonthlySalary,
} from "../../src/services/assignmentFinance.js";

describe("assignmentFinance monthly salary", () => {
  it("detects active FIXED compensation as monthly salary", () => {
    assert.equal(
      teamProfileHasMonthlySalary({
        compensationProfile: { type: "FIXED", isActive: true },
      }),
      true,
    );
  });

  it("treats PROJECT_SHARE and missing profiles as project-based", () => {
    assert.equal(teamProfileHasMonthlySalary({}), false);
    assert.equal(
      teamProfileHasMonthlySalary({
        compensationProfile: { type: "PROJECT_SHARE", isActive: true },
      }),
      false,
    );
    assert.equal(
      teamProfileHasMonthlySalary({
        compensationProfile: { type: "FIXED", isActive: false },
      }),
      false,
    );
  });

  it("skips amount parsing for monthly-salary assignees", () => {
    assert.equal(
      resolveAssignmentAmount("1500", {
        fieldLabel: "هزینه ادیت",
        hasMonthlySalary: true,
      }),
      null,
    );
  });

  it("still requires a valid amount for project-share assignees", () => {
    assert.equal(
      resolveAssignmentAmount("1,200", {
        fieldLabel: "هزینه ادیت",
        hasMonthlySalary: false,
      }),
      1200,
    );
    assert.throws(
      () =>
        resolveAssignmentAmount("", {
          fieldLabel: "هزینه ادیت",
          hasMonthlySalary: false,
        }),
      /هزینه ادیت الزامی است/,
    );
    assert.equal(parseAssignmentAmount("10"), 10);
  });
});
