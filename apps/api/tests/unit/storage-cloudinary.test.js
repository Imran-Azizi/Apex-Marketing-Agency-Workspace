import test from "node:test";
import assert from "node:assert/strict";
import {
  extensionOf,
  resolveCloudinaryResourceType,
  toCloudinaryPublicId,
} from "../../src/services/storage/resource-type.js";
import {
  ALLOWED_UPLOAD_FOLDERS,
  MEDIA_ROOTS,
  UPLOAD_PURPOSE,
  generateStorageKey,
  getMediaCategory,
  getMediaFolderLabel,
  normalizeUploadFolder,
  parseUploadContext,
  resolveMediaPlacement,
} from "../../src/services/storage/media-manager.js";

test("extensionOf extracts lowercase extension", () => {
  assert.equal(extensionOf("client-assets/a/b.PNG"), "png");
  assert.equal(extensionOf("file.tar.gz"), "gz");
  assert.equal(extensionOf("noext"), undefined);
});

test("toCloudinaryPublicId strips last extension only", () => {
  assert.equal(
    toCloudinaryPublicId("images/123-ab-logo.png"),
    "images/123-ab-logo",
  );
});

test("resolveCloudinaryResourceType maps mime and extensions", () => {
  assert.equal(
    resolveCloudinaryResourceType({ contentType: "image/png" }),
    "image",
  );
  assert.equal(
    resolveCloudinaryResourceType({ contentType: "audio/mpeg" }),
    "video",
  );
  assert.equal(
    resolveCloudinaryResourceType({ filename: "brief.pdf" }),
    "raw",
  );
});

test("resolveMediaPlacement routes by purpose", () => {
  const portalImage = resolveMediaPlacement(
    { purpose: UPLOAD_PURPOSE.PORTAL_ASSET },
    { contentType: "image/png", filename: "logo.png" },
  );
  assert.equal(portalImage.folderPath, MEDIA_ROOTS.IMAGES);

  const portalDoc = resolveMediaPlacement(
    { purpose: UPLOAD_PURPOSE.PORTAL_ASSET },
    { contentType: "application/pdf", filename: "book.pdf" },
  );
  assert.equal(portalDoc.folderPath, MEDIA_ROOTS.DOCUMENTS);

  const narration = resolveMediaPlacement(
    {
      purpose: UPLOAD_PURPOSE.NARRATION_AUDIO,
      projectId: "proj123",
    },
    { contentType: "audio/mpeg", filename: "voice.mp3" },
  );
  assert.equal(narration.folderPath, "projects/proj123/audio");

  const finalWm = resolveMediaPlacement(
    {
      purpose: UPLOAD_PURPOSE.PRODUCTION_FINAL,
      projectId: "proj123",
      videoType: "WATERMARKED",
    },
    { contentType: "video/mp4", filename: "final.mp4" },
  );
  assert.equal(finalWm.folderPath, "projects/proj123/final/watermarked");

  const profile = resolveMediaPlacement(
    {
      purpose: UPLOAD_PURPOSE.EMPLOYEE_PROFILE,
      userId: "user456",
    },
    { contentType: "image/jpeg", filename: "avatar.jpg" },
  );
  assert.equal(profile.folderPath, "users/user456");
});

test("parseUploadContext maps legacy folders to purpose", () => {
  const ctx = parseUploadContext({ folder: "client-assets" }, {});
  assert.equal(ctx.purpose, UPLOAD_PURPOSE.PORTAL_ASSET);

  const audioCtx = parseUploadContext(
    { folder: "project-audio", projectId: "abc" },
    {},
  );
  assert.equal(audioCtx.purpose, UPLOAD_PURPOSE.NARRATION_AUDIO);
  assert.equal(audioCtx.projectId, "abc");
});

test("normalizeUploadFolder accepts legacy and new roots", () => {
  assert.ok(ALLOWED_UPLOAD_FOLDERS.includes("client-assets"));
  assert.ok(ALLOWED_UPLOAD_FOLDERS.includes(MEDIA_ROOTS.IMAGES));
  assert.equal(normalizeUploadFolder("images"), MEDIA_ROOTS.IMAGES);
  assert.equal(normalizeUploadFolder("../etc"), MEDIA_ROOTS.UPLOADS);
  assert.equal(
    normalizeUploadFolder("projects/proj123/audio"),
    "projects/proj123/audio",
  );
});

test("generateStorageKey builds hierarchical keys", () => {
  const key = generateStorageKey("images", "logo.png");
  assert.match(key, /^images\/\d+-[a-f0-9]+-logo\.png$/);
});

test("getMediaCategory supports legacy and new keys", () => {
  assert.equal(
    getMediaCategory("client-assets/old.png", { contentType: "image/png" }),
    MEDIA_ROOTS.IMAGES,
  );
  assert.equal(
    getMediaCategory("projects/p1/final/clean/v1.mp4"),
    MEDIA_ROOTS.VIDEOS,
  );
  assert.equal(getMediaFolderLabel("users/u1/a.jpg"), "پروفایل کاربر");
});
