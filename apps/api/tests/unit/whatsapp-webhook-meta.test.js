import assert from "node:assert/strict";
import { describe, it } from "node:test";
import crypto from "node:crypto";
import {
  WHATSAPP_WEBSITE_SOURCE_MARKER,
  detectWebsiteSourceFromText,
  extractInboundMessages,
  resolveInboundLeadSource,
  verifyHmacSha256,
  verifyMetaSignature,
  verifyMetaSubscribeChallenge,
} from "../../src/modules/whatsapp-webhook/meta.js";

describe("whatsapp webhook meta helpers", () => {
  it("detects public website source marker", () => {
    const text = `سلام\n${WHATSAPP_WEBSITE_SOURCE_MARKER}`;
    assert.equal(detectWebsiteSourceFromText(text), true);
    assert.equal(resolveInboundLeadSource(text), "WHATSAPP_WEBSITE");
    assert.equal(resolveInboundLeadSource("سلام فقط"), "WHATSAPP");
  });

  it("verifies subscribe challenge with matching token", () => {
    // When verify token is unset, challenge must fail closed.
    assert.equal(
      verifyMetaSubscribeChallenge({
        "hub.mode": "subscribe",
        "hub.verify_token": "x",
        "hub.challenge": "123",
      }),
      null,
    );
  });

  it("validates HMAC signatures", () => {
    const secret = "test-app-secret-for-unit";
    const body = Buffer.from('{"object":"whatsapp_business_account"}', "utf8");
    const digest = crypto
      .createHmac("sha256", secret)
      .update(body)
      .digest("hex");
    assert.equal(verifyHmacSha256(body, `sha256=${digest}`, secret), true);
    assert.equal(verifyHmacSha256(body, `sha256=${digest}`, "wrong"), false);
    assert.equal(verifyHmacSha256(body, "not-a-sig", secret), false);
    // Unconfigured Meta secret rejects (env empty in unit tests).
    assert.equal(verifyMetaSignature(body, `sha256=${digest}`), false);
  });

  it("extracts inbound text messages and contact names", () => {
    const payload = {
      object: "whatsapp_business_account",
      entry: [
        {
          changes: [
            {
              field: "messages",
              value: {
                metadata: { phone_number_id: "123" },
                contacts: [
                  {
                    wa_id: "93700111222",
                    profile: { name: "Ahmad" },
                  },
                ],
                messages: [
                  {
                    from: "93700111222",
                    id: "wamid.TEST1",
                    timestamp: "1710000000",
                    type: "text",
                    text: {
                      body: `سلام\n${WHATSAPP_WEBSITE_SOURCE_MARKER}`,
                    },
                  },
                ],
              },
            },
          ],
        },
      ],
    };

    const msgs = extractInboundMessages(payload);
    assert.equal(msgs.length, 1);
    assert.equal(msgs[0].providerMsgId, "wamid.TEST1");
    assert.equal(msgs[0].fromWaId, "93700111222");
    assert.equal(msgs[0].displayName, "Ahmad");
    assert.equal(
      resolveInboundLeadSource(msgs[0].text),
      "WHATSAPP_WEBSITE",
    );
  });

  it("ignores status-only webhooks", () => {
    const payload = {
      object: "whatsapp_business_account",
      entry: [
        {
          changes: [
            {
              field: "messages",
              value: {
                statuses: [{ id: "wamid.x", status: "delivered" }],
              },
            },
          ],
        },
      ],
    };
    assert.deepEqual(extractInboundMessages(payload), []);
  });
});
