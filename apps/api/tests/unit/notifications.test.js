import test from "node:test";
import assert from "node:assert/strict";
import {
  parseViewedBefore,
  recipientWhere,
  unseenWhere,
} from "../../src/services/notifications.js";

test("recipientWhere isolates internal users from portal accounts", () => {
  assert.deepEqual(recipientWhere({ audience: "INTERNAL", userId: "user-1" }), {
    userId: "user-1",
  });
  assert.deepEqual(
    recipientWhere({ audience: "PORTAL", portalAccountId: "portal-1" }),
    { portalAccountId: "portal-1" },
  );
});

test("unseenWhere scopes to the recipient and unread rows", () => {
  const where = unseenWhere({ audience: "INTERNAL", userId: "u1" });
  assert.equal(where.userId, "u1");
  assert.equal(where.isRead, false);
  assert.equal(where.createdAt, undefined);
});

test("unseenWhere applies viewedBefore cutoff so later notifications stay unseen", () => {
  const at = "2026-08-18T10:00:00.000Z";
  const where = unseenWhere({ audience: "INTERNAL", userId: "u1" }, at);
  assert.deepEqual(where.createdAt, { lte: new Date(at) });
});

test("parseViewedBefore accepts ISO timestamps and rejects invalid values", () => {
  const iso = "2026-08-18T10:00:00.000Z";
  assert.equal(parseViewedBefore(iso)?.toISOString(), iso);
  assert.equal(parseViewedBefore(null), null);
  assert.equal(parseViewedBefore(""), null);
  assert.equal(parseViewedBefore("not-a-date"), null);
});
