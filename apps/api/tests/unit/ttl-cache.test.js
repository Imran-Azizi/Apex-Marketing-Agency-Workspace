import test from "node:test";
import assert from "node:assert/strict";
import { createTtlCache } from "../../src/utils/ttlCache.js";

test("getOrSet stores and returns the factory value", async () => {
  const cache = createTtlCache();
  let calls = 0;
  const value = await cache.getOrSet("k", 5_000, () => {
    calls += 1;
    return "ok";
  });
  assert.equal(value, "ok");
  assert.equal(await cache.getOrSet("k", 5_000, () => "other"), "ok");
  assert.equal(calls, 1);
});

test("concurrent getOrSet shares a single factory run", async () => {
  const cache = createTtlCache();
  let calls = 0;
  const factory = async () => {
    calls += 1;
    await new Promise((r) => setTimeout(r, 20));
    return calls;
  };
  const [a, b, c] = await Promise.all([
    cache.getOrSet("shared", 5_000, factory),
    cache.getOrSet("shared", 5_000, factory),
    cache.getOrSet("shared", 5_000, factory),
  ]);
  assert.equal(a, 1);
  assert.equal(b, 1);
  assert.equal(c, 1);
  assert.equal(calls, 1);
});

test("expired entries are recomputed", async () => {
  const cache = createTtlCache();
  let calls = 0;
  await cache.getOrSet("exp", 1, () => {
    calls += 1;
    return "first";
  });
  await new Promise((r) => setTimeout(r, 5));
  const next = await cache.getOrSet("exp", 1_000, () => {
    calls += 1;
    return "second";
  });
  assert.equal(next, "second");
  assert.equal(calls, 2);
});
