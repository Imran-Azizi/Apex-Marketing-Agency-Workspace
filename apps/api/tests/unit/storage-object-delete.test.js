import test from "node:test";
import assert from "node:assert/strict";
import {
  collectStorageKeys,
  resolveStorageKey,
  deleteStoredObject,
} from "../../src/services/storage/object-delete.js";

test("resolveStorageKey normalizes nested keys and strips prefixes", () => {
  assert.equal(
    resolveStorageKey("images/hero/file.jpg"),
    "images/hero/file.jpg",
  );
  assert.equal(
    resolveStorageKey("/images/docs/nested/a.pdf"),
    "images/docs/nested/a.pdf",
  );
  assert.equal(resolveStorageKey("ref://x"), null);
  assert.equal(resolveStorageKey("inline"), null);
  assert.equal(resolveStorageKey(""), null);
});

test("resolveStorageKey extracts key from CDN-style URLs", () => {
  const key = resolveStorageKey(
    "https://cdn.example.com/apex/videos/project/a.mp4?token=1",
  );
  assert.equal(key, "videos/project/a.mp4");
});

test("collectStorageKeys de-duplicates values", () => {
  assert.deepEqual(
    collectStorageKeys(
      ["a/b.png", "a/b.png"],
      "c/d.pdf",
      null,
      "ref://skip",
    ).sort(),
    ["a/b.png", "c/d.pdf"],
  );
});

test("deleteStoredObject treats empty key as skipped", async () => {
  let called = false;
  const result = await deleteStoredObject(
    async () => {
      called = true;
    },
    null,
    { required: true },
  );
  assert.equal(called, false);
  assert.equal(result.skipped, true);
});

test("deleteStoredObject requires success and surfaces failures", async () => {
  await assert.rejects(
    () =>
      deleteStoredObject(
        async () => {
          const err = new Error("boom");
          err.status = 502;
          throw err;
        },
        "images/x.png",
        { required: true, logTag: "test" },
      ),
    (err) => err?.code === "STORAGE_DELETE_FAILED",
  );
});

test("deleteStoredObject best-effort mode does not throw", async () => {
  const result = await deleteStoredObject(
    async () => {
      throw new Error("network");
    },
    "images/x.png",
    { required: false, logTag: "test" },
  );
  assert.equal(result.deleted, false);
  assert.equal(result.key, "images/x.png");
});
