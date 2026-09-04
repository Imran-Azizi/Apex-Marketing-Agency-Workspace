import test from "node:test";
import assert from "node:assert/strict";
import {
  isAcceptedPosterMime,
  markLatestFlags,
  POSTER_STATUS_LABELS,
  serializePoster,
} from "../../src/modules/production/poster.js";

test("poster mime validation accepts common image types", () => {
  assert.equal(isAcceptedPosterMime("image/jpeg", "a.jpg"), true);
  assert.equal(isAcceptedPosterMime("image/png", "a.png"), true);
  assert.equal(isAcceptedPosterMime("video/mp4", "a.mp4"), false);
  assert.equal(isAcceptedPosterMime("", "poster.webp"), true);
});

test("serializePoster hides internal review fields from customers", () => {
  const row = {
    id: "p1",
    projectId: "proj",
    crmCustomerId: "c1",
    fileId: "f1",
    version: 2,
    notes: "internal note",
    status: "SENT_TO_CUSTOMER",
    uploadedById: "u1",
    uploadedBy: { fullName: "Editor" },
    reviewedBy: { fullName: "Manager" },
    reviewedAt: new Date("2026-09-01"),
    rejectionReason: "not this",
    deliveredAt: new Date("2026-09-02"),
    deliveredBy: { fullName: "Manager" },
    createdAt: new Date("2026-09-01"),
    updatedAt: new Date("2026-09-02"),
    file: {
      name: "poster.jpg",
      mimeType: "image/jpeg",
      sizeBytes: 1200,
      storageKey: "projects/proj/posters/1.jpg",
    },
  };

  const internal = serializePoster(row);
  assert.equal(internal.statusLabel, POSTER_STATUS_LABELS.SENT_TO_CUSTOMER);
  assert.equal(internal.rejectionReason, "not this");
  assert.equal(internal.uploadedByName, "Editor");
  assert.equal(internal.storageKey, "projects/proj/posters/1.jpg");

  const customer = serializePoster(row, { forCustomer: true });
  assert.equal(customer.uploadedByName, null);
  assert.equal(customer.notes, null);
  assert.equal(customer.rejectionReason, undefined);
  assert.equal(customer.storageKey, undefined);
});

test("markLatestFlags identifies newest and latest delivered posters", () => {
  const flagged = markLatestFlags([
    { id: "a", version: 1, status: "REJECTED" },
    { id: "b", version: 2, status: "SENT_TO_CUSTOMER" },
    { id: "c", version: 3, status: "PENDING_REVIEW" },
  ]);
  assert.equal(flagged.find((i) => i.id === "c").isLatest, true);
  assert.equal(flagged.find((i) => i.id === "b").isLatestDelivered, true);
  assert.equal(flagged.find((i) => i.id === "a").isLatest, false);
});
