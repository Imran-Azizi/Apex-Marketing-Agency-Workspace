import test from "node:test";
import assert from "node:assert/strict";
import {
  contractProgressPayload,
  summarizeContractVideos,
} from "../../src/modules/projects/contractVideoStats.js";

test("summarizeContractVideos splits completed, in progress, and pending", () => {
  const stats = summarizeContractVideos([
    { status: "COMPLETED" },
    { status: "COMPLETED" },
    { status: "COMPLETED" },
    { status: "COMPLETED" },
    { status: "COMPLETED" },
    { status: "COMPLETED" },
    { status: "PRODUCTION_EDITING" },
    { status: "NARRATION_RECORDING" },
    { status: "NEW_MANAGER_REVIEW" },
    { status: "ON_HOLD" },
    { status: "CANCELED" },
  ]);

  assert.deepEqual(stats, {
    total: 10,
    completed: 6,
    inProgress: 2,
    pending: 2,
    canceled: 1,
    progressPercent: 60,
  });
});

test("summarizeContractVideos is empty-safe and does not cap the count", () => {
  assert.equal(summarizeContractVideos([]).total, 0);
  assert.equal(summarizeContractVideos([]).progressPercent, 0);

  const many = Array.from({ length: 25 }, () => ({ status: "CONTENT_GENERATION" }));
  assert.equal(summarizeContractVideos(many).total, 25);
  assert.equal(summarizeContractVideos(many).inProgress, 25);
});

test("contractProgressPayload follows the completed share", () => {
  const payload = contractProgressPayload(
    summarizeContractVideos([
      { status: "COMPLETED" },
      { status: "NEW_MANAGER_REVIEW" },
    ]),
  );
  assert.equal(payload.percent, 50);
  assert.equal(payload.isComplete, false);
  assert.equal(payload.completedCount, 1);
});
