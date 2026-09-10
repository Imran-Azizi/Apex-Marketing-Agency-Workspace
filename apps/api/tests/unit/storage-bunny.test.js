import test from "node:test";
import assert from "node:assert/strict";
import {
  bunnyObjectPath,
  signBunnyCdnUrl,
} from "../../src/services/storage/bunny-driver.js";

test("bunnyObjectPath prefixes keys once", () => {
  const prefixed = bunnyObjectPath("images/hero/a.jpg");
  assert.ok(prefixed.endsWith("images/hero/a.jpg"));
  assert.equal(bunnyObjectPath(prefixed), prefixed);
});

test("signBunnyCdnUrl is a no-op without a token key", () => {
  const url = "https://cdn.example.com/apex/images/hero/a.jpg";
  const signed = signBunnyCdnUrl(url, 60);
  if (!process.env.BUNNY_CDN_TOKEN_KEY) {
    assert.equal(signed, url);
  } else {
    assert.match(signed, /[?&]token=/);
    assert.match(signed, /[?&]expires=/);
  }
});

test("signBunnyCdnUrl with explicit env token produces query params", async () => {
  const { applyBunnyCdnToken } = await import(
    "../../src/services/storage/bunny-driver.js"
  );
  const url = "https://example.b-cdn.net/apex/videos/clip.mp4";
  const signed = applyBunnyCdnToken(url, "test-security-key", 120);
  const parsed = new URL(signed);
  assert.equal(parsed.origin, "https://example.b-cdn.net");
  assert.equal(parsed.pathname, "/apex/videos/clip.mp4");
  assert.ok(parsed.searchParams.get("token"));
  assert.ok(Number(parsed.searchParams.get("expires")) > Math.floor(Date.now() / 1000));
});
