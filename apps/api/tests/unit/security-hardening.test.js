import test from "node:test";
import assert from "node:assert/strict";
import jwt from "jsonwebtoken";
import { isStrongPassword } from "../../src/utils/passwords.js";
import { parsePagination } from "../../src/utils/pagination.js";
import { isSafeExternalUrl, assertSafeExternalUrl } from "../../src/utils/ssrf.js";
import {
  isPublicStorageKey,
  isCleanFinalStorageKey,
  stripStoragePrefix,
} from "../../src/services/storage/media-manager.js";
import { canAccessProject } from "../../src/services/projectAccess.js";
import {
  assertLoginNotLocked,
  recordLoginFailure,
  clearLoginFailures,
  loginAttemptKey,
  _resetLoginGuardForTests,
} from "../../src/middleware/loginGuard.js";
import { verifyAccessToken, signAccessToken } from "../../src/utils/tokens.js";
import { requirePermission } from "../../src/middleware/rbac.js";
import { AppError } from "../../src/utils/response.js";
import { SECURITY } from "../../src/config/security.js";
import { normalizeStorageKey } from "../../src/modules/files/rawAccess.js";

test("password policy rejects weak passwords", () => {
  assert.equal(isStrongPassword("12345678"), false);
  assert.equal(isStrongPassword("password"), false);
  assert.equal(isStrongPassword("short1"), false);
  assert.equal(isStrongPassword("ApexPass1"), true);
  assert.equal(isStrongPassword("رمزعبور1234"), true);
});

test("pagination clamps oversized and negative values", () => {
  const a = parsePagination({ page: "-3", limit: "999999" });
  assert.equal(a.page, 1);
  assert.equal(a.pageSize, 100);
  const b = parsePagination({ page: "2", pageSize: "5" });
  assert.equal(b.page, 2);
  assert.equal(b.skip, 5);
  assert.equal(b.take, 5);
});

test("SSRF helper blocks loopback and metadata hosts", () => {
  assert.equal(isSafeExternalUrl("http://127.0.0.1/secret"), false);
  assert.equal(isSafeExternalUrl("http://localhost/admin"), false);
  assert.equal(isSafeExternalUrl("http://169.254.169.254/latest/meta-data"), false);
  assert.equal(isSafeExternalUrl("http://192.168.1.10/internal"), false);
  assert.equal(isSafeExternalUrl("file:///etc/passwd"), false);
  assert.equal(isSafeExternalUrl("https://cdn.example.com/img.png"), true);
  assert.throws(() => assertSafeExternalUrl("http://10.0.0.5"));
});

test("public storage keys allow marketing prefixes only", () => {
  assert.equal(isPublicStorageKey("apex/images/hero/slide.jpg"), true);
  assert.equal(isPublicStorageKey("images/portfolio/thumb.webp"), true);
  assert.equal(isPublicStorageKey("videos/portfolio/show.mp4"), true);
  assert.equal(isPublicStorageKey("images/landing/hero.webp"), true);
  assert.equal(isPublicStorageKey("videos/landing/clip.mp4"), true);
  assert.equal(isPublicStorageKey("audio/landing/voice.mp3"), true);
  assert.equal(isPublicStorageKey("apex/projects/abc/final/watermarked/x.mp4"), false);
  assert.equal(isPublicStorageKey("../etc/passwd"), false);
  assert.equal(isCleanFinalStorageKey("projects/abc/final/clean/video.mp4"), true);
  assert.equal(stripStoragePrefix("apex/images/hero/a.jpg"), "images/hero/a.jpg");
});

test("storage key normalization rejects traversal", () => {
  assert.throws(
    () => normalizeStorageKey("../etc/passwd"),
    (err) => err instanceof AppError && err.code === "INVALID_KEY",
  );
  assert.equal(normalizeStorageKey("apex/images/hero/a.jpg"), "apex/images/hero/a.jpg");
});

test("project access is assignment-scoped for editors", () => {
  const project = {
    assignments: [
      { isActive: true, userId: "editor-1", teamProfile: null },
    ],
  };
  assert.equal(canAccessProject(project, { roleCode: "MANAGER", userId: "m1" }), true);
  assert.equal(canAccessProject(project, { roleCode: "EDITOR", userId: "editor-1" }), true);
  assert.equal(canAccessProject(project, { roleCode: "EDITOR", userId: "editor-2" }), false);
  assert.equal(canAccessProject(project, { roleCode: "NARRATOR", userId: "n1" }), false);
  assert.equal(canAccessProject(project, null), false);
});

test("login guard locks after repeated failures", () => {
  _resetLoginGuardForTests();
  const key = loginAttemptKey({ identity: "user@example.com", ip: "1.2.3.4" });
  for (let i = 0; i < SECURITY.loginGuard.maxFailures; i += 1) {
    recordLoginFailure(key);
  }
  assert.throws(
    () => assertLoginNotLocked(key),
    (err) => err instanceof AppError && err.code === "RATE_LIMITED",
  );
  clearLoginFailures(key);
  assert.doesNotThrow(() => assertLoginNotLocked(key));
  _resetLoginGuardForTests();
});

test("JWT verification rejects none algorithm and unknown audience", () => {
  const header = Buffer.from(
    JSON.stringify({ alg: "none", typ: "JWT" }),
  ).toString("base64url");
  const body = Buffer.from(
    JSON.stringify({ sub: "u1", aud: "INTERNAL", sid: "s1" }),
  ).toString("base64url");
  const noneToken = `${header}.${body}.`;
  assert.throws(() => verifyAccessToken(noneToken));

  const hs256 = signAccessToken({ sub: "u1", aud: "INTERNAL", role: "MANAGER", sid: "s1" });
  const payload = verifyAccessToken(hs256);
  assert.equal(payload.aud, "INTERNAL");

  const badAud = jwt.sign(
    { sub: "u1", aud: "HACKER", sid: "s1" },
    process.env.JWT_ACCESS_SECRET || "dev-access-secret-min-32-characters-xx",
    { algorithm: "HS256" },
  );
  assert.throws(() => verifyAccessToken(badAud));
});

test("requirePermission denies when no codes are provided", async () => {
  const mw = requirePermission();
  const req = { auth: { permissions: ["crm.view"], roleCode: "SALES" } };
  const err = await new Promise((resolve) => {
    mw(req, {}, resolve);
  });
  assert.equal(err instanceof AppError, true);
  assert.equal(err.code, "FORBIDDEN");
});
