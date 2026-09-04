import test from "node:test";
import assert from "node:assert/strict";
import {
  directConversationKey,
  orderedUserPair,
  isChatManagerRole,
  isChatEmployeeRole,
  previewFromMessage,
  CHAT_REACTION_EMOJIS,
} from "../../src/modules/chat/constants.js";
import { validateChatUpload } from "../../src/modules/chat/upload.js";

test("directConversationKey is order-independent", () => {
  assert.equal(directConversationKey("a", "b"), directConversationKey("b", "a"));
  assert.equal(directConversationKey("user2", "user1"), "user1:user2");
});

test("orderedUserPair sorts ids", () => {
  assert.deepEqual(orderedUserPair("z", "a"), {
    userLowId: "a",
    userHighId: "z",
  });
});

test("role helpers classify managers vs employees", () => {
  assert.equal(isChatManagerRole("MANAGER"), true);
  assert.equal(isChatManagerRole("ADMIN"), true);
  assert.equal(isChatManagerRole("SALES"), false);
  assert.equal(isChatEmployeeRole("EDITOR"), true);
  assert.equal(isChatEmployeeRole("MANAGER"), false);
});

test("previewFromMessage covers media types", () => {
  assert.match(previewFromMessage({ type: "VOICE" }), /صوتی/);
  assert.match(previewFromMessage({ type: "IMAGE" }), /تصویر/);
  assert.equal(previewFromMessage({ type: "TEXT", body: "سلام" }), "سلام");
});

test("reaction allow-list is small and fixed", () => {
  assert.equal(CHAT_REACTION_EMOJIS.has("👍"), true);
  assert.equal(CHAT_REACTION_EMOJIS.has("<script>"), false);
});

test("validateChatUpload rejects empty file", () => {
  assert.throws(
    () => validateChatUpload({ buffer: Buffer.alloc(0), mimetype: "image/png" }),
    (err) => err.code === "EMPTY_FILE",
  );
});

test("validateChatUpload accepts PNG magic bytes", () => {
  const buf = Buffer.from([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x01,
  ]);
  const result = validateChatUpload({
    buffer: buf,
    mimetype: "application/octet-stream",
    originalname: "evil.exe",
  });
  assert.equal(result.mimeType, "image/png");
  assert.equal(result.kind, "IMAGE");
});

test("validateChatUpload rejects oversized voice", () => {
  const buf = Buffer.alloc(11 * 1024 * 1024, 1);
  buf[0] = 0x1a;
  buf[1] = 0x45;
  buf[2] = 0xdf;
  assert.throws(
    () =>
      validateChatUpload(
        { buffer: buf, mimetype: "audio/webm", originalname: "v.webm" },
        { isVoice: true },
      ),
    (err) => err.code === "FILE_TOO_LARGE",
  );
});

test("validateChatUpload rejects disallowed types", () => {
  assert.throws(
    () =>
      validateChatUpload({
        buffer: Buffer.from("MZ"),
        mimetype: "application/x-msdownload",
        originalname: "malware.exe",
      }),
    (err) => err.code === "FILE_TYPE_NOT_ALLOWED",
  );
});
