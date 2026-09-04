import test from "node:test";
import assert from "node:assert/strict";
import {
  buildFinalFileMeta,
  isAlreadyDelivered,
  isSentToCustomer,
  markSentFinalsApprovedByCustomer,
  markSentMeta,
  markViewedMeta,
  projectStatusPatchAfterSend,
  isNewForCustomer,
  sortPortalFinalVideos,
  resolveDeliveryState,
  serializeFinalVideo,
  shouldPreserveProjectStatus,
  wasExplicitlySent,
  isCustomerApprovedFile,
  allSentFilesCustomerApproved,
  markCustomerApprovedMeta,
} from "../../src/modules/production/finalProduct.js";

function file(overrides = {}) {
  return {
    id: "f1",
    name: "wm.mp4",
    kind: "WATERMARKED_FINAL",
    version: 2,
    mimeType: "video/mp4",
    sizeBytes: 10,
    storageKey: "k",
    uploadedBy: "u1",
    createdAt: new Date("2026-09-01"),
    updatedAt: new Date("2026-09-01"),
    meta: {
      videoType: "WATERMARKED",
      status: "PENDING_REVIEW",
      sentToCustomer: false,
    },
    ...overrides,
  };
}

test("new editor uploads stay unsent even after the project was delivered", () => {
  const uploaded = file();
  assert.equal(isSentToCustomer(uploaded, "WAITING_CLIENT_FINAL_APPROVAL"), false);
  assert.equal(isAlreadyDelivered(uploaded, "COMPLETED"), false);
  assert.equal(wasExplicitlySent(uploaded), false);

  const serialized = serializeFinalVideo(uploaded, {
    projectStatus: "WAITING_CLIENT_FINAL_APPROVAL",
    customerApproved: true,
  });
  assert.equal(serialized.sentToCustomer, false);
  assert.equal(serialized.status, "PENDING_REVIEW");
  assert.equal(serialized.deliveryState, "PENDING_REVIEW");
  assert.equal(serialized.isNew, true);
  assert.equal(serialized.alreadySent, false);
});

test("approved unsent videos are awaiting manager delivery, not already sent", () => {
  const approved = file({
    meta: {
      videoType: "WATERMARKED",
      status: "APPROVED",
      sentToCustomer: false,
      approvedAt: "2026-09-02T00:00:00.000Z",
    },
  });
  const serialized = serializeFinalVideo(approved, {
    projectStatus: "COMPLETED",
    customerApproved: true,
  });
  assert.equal(serialized.status, "APPROVED");
  assert.equal(serialized.deliveryState, "AWAITING_DELIVERY");
  assert.equal(serialized.awaitingDelivery, true);
  assert.equal(serialized.sentToCustomer, false);
});

test("explicitly sent videos keep sent tracking", () => {
  const sent = file({
    meta: markSentMeta(
      { videoType: "WATERMARKED", status: "APPROVED", sentToCustomer: false },
      { sentAt: new Date("2026-09-02T10:00:00.000Z"), sentBy: "mgr-1" },
    ),
  });
  assert.equal(wasExplicitlySent(sent), true);
  const serialized = serializeFinalVideo(sent, {
    projectStatus: "WAITING_CLIENT_FINAL_APPROVAL",
    sentByName: "مدیر",
  });
  assert.equal(serialized.alreadySent, true);
  assert.equal(serialized.sentBy, "mgr-1");
  assert.equal(serialized.sentByName, "مدیر");
  assert.equal(serialized.deliveryState, "SENT");
});

test("customer approval backfill skips files the manager never released", async () => {
  const updates = [];
  const db = {
    projectFile: {
      findMany: async () => [
        file({ id: "new" }),
        file({
          id: "old",
          meta: {
            videoType: "WATERMARKED",
            status: "SENT_TO_CUSTOMER",
            sentToCustomer: true,
          },
        }),
      ],
      update: async ({ where, data }) => {
        updates.push({ id: where.id, status: data.meta.status });
      },
    },
  };

  const count = await markSentFinalsApprovedByCustomer(db, "proj");
  assert.equal(count, 1);
  assert.equal(updates.length, 1);
  assert.equal(updates[0].id, "old");
  assert.equal(updates[0].status, "APPROVED_BY_CUSTOMER");
});

test("new uploads always start with sentToCustomer false", () => {
  const meta = buildFinalFileMeta({
    videoType: "CLEAN",
    status: "PENDING_REVIEW",
    extras: { sentToCustomer: false },
  });
  assert.equal(meta.sentToCustomer, false);
  assert.equal(meta.status, "PENDING_REVIEW");
});

test("additional deliveries do not roll back settled project statuses", () => {
  assert.equal(shouldPreserveProjectStatus("COMPLETED"), true);
  assert.equal(shouldPreserveProjectStatus("WAITING_PAYMENT"), true);
  assert.equal(shouldPreserveProjectStatus("WAITING_CLIENT_FINAL_APPROVAL"), true);
  assert.equal(shouldPreserveProjectStatus("MANAGER_FINAL_REVIEW"), false);
  assert.equal(projectStatusPatchAfterSend("COMPLETED"), null);
  assert.deepEqual(projectStatusPatchAfterSend("MANAGER_FINAL_REVIEW"), {
    status: "WAITING_CLIENT_FINAL_APPROVAL",
    customerFacingStatus: "WAITING_YOUR_APPROVAL",
  });
});

test("legacy watermarked files without a per-file flag stay visible after first delivery", () => {
  const legacy = file({
    meta: { videoType: "WATERMARKED", status: "UPLOADED" },
  });
  assert.equal(isSentToCustomer(legacy, "WAITING_CLIENT_FINAL_APPROVAL"), true);
  assert.equal(resolveDeliveryState(legacy, "WAITING_CLIENT_FINAL_APPROVAL"), "SENT");
});

test("portal new badge only for explicitly sent and unviewed videos", () => {
  const fresh = file({
    meta: markSentMeta(
      { videoType: "WATERMARKED", status: "SENT_TO_CUSTOMER" },
      { sentAt: new Date("2026-09-03T12:00:00.000Z") },
    ),
  });
  assert.equal(isNewForCustomer(fresh, "COMPLETED"), true);
  const serialized = serializeFinalVideo(fresh, { projectStatus: "COMPLETED" });
  assert.equal(serialized.isNewForCustomer, true);

  const viewed = file({
    meta: markViewedMeta(fresh.meta),
  });
  assert.equal(isNewForCustomer(viewed, "COMPLETED"), false);
  assert.equal(
    serializeFinalVideo(viewed, { projectStatus: "COMPLETED" }).isNewForCustomer,
    false,
  );

  const unsent = file({ meta: { videoType: "WATERMARKED", status: "PENDING_REVIEW", sentToCustomer: false } });
  assert.equal(isNewForCustomer(unsent, "COMPLETED"), false);
});

test("portal sort puts unviewed new videos first then newest sentAt", () => {
  const olderSent = file({
    id: "old",
    version: 1,
    meta: markViewedMeta(
      markSentMeta(
        { videoType: "WATERMARKED", status: "SENT_TO_CUSTOMER" },
        { sentAt: new Date("2026-09-01T10:00:00.000Z") },
      ),
    ),
  });
  const viewedNew = file({
    id: "viewed",
    version: 3,
    meta: markViewedMeta(
      markSentMeta(
        { videoType: "WATERMARKED", status: "SENT_TO_CUSTOMER" },
        { sentAt: new Date("2026-09-03T10:00:00.000Z") },
      ),
    ),
  });
  const freshNew = file({
    id: "fresh",
    version: 4,
    meta: markSentMeta(
      { videoType: "WATERMARKED", status: "SENT_TO_CUSTOMER" },
      { sentAt: new Date("2026-09-03T11:00:00.000Z") },
    ),
  });

  const sorted = sortPortalFinalVideos(
    [olderSent, viewedNew, freshNew],
    "WAITING_CLIENT_FINAL_APPROVAL",
  );
  assert.deepEqual(
    sorted.map((f) => f.id),
    ["fresh", "viewed", "old"],
  );
});

test("isCustomerApprovedFile detects per-file customer approval", () => {
  const approved = file({
    meta: markCustomerApprovedMeta(
      markSentMeta({ videoType: "WATERMARKED" }),
    ),
  });
  assert.equal(isCustomerApprovedFile(approved), true);

  const pending = file({
    meta: markSentMeta({ videoType: "WATERMARKED" }),
  });
  assert.equal(isCustomerApprovedFile(pending), false);
});

test("allSentFilesCustomerApproved requires every sent file to be approved", () => {
  const sent = file({
    id: "a",
    meta: markSentMeta({ videoType: "WATERMARKED" }),
  });
  const approved = file({
    id: "b",
    meta: markCustomerApprovedMeta(
      markSentMeta({ videoType: "WATERMARKED" }),
    ),
  });
  const status = "WAITING_CLIENT_FINAL_APPROVAL";

  assert.equal(allSentFilesCustomerApproved([sent], status), false);
  assert.equal(allSentFilesCustomerApproved([approved], status), true);
  assert.equal(allSentFilesCustomerApproved([sent, approved], status), false);
  assert.equal(
    allSentFilesCustomerApproved(
      [
        file({
          id: "c",
          meta: markCustomerApprovedMeta(
            markSentMeta({ videoType: "WATERMARKED" }),
          ),
        }),
        file({
          id: "d",
          meta: markCustomerApprovedMeta(
            markSentMeta({ videoType: "WATERMARKED" }),
          ),
        }),
      ],
      status,
    ),
    true,
  );
});
