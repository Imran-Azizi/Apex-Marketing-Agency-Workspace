import { Router } from "express";
import { env } from "../../config/env.js";
import {
  isWhatsAppWebhookConfigured,
  verifyMetaSignature,
  verifyMetaSubscribeChallenge,
} from "./meta.js";
import { processWhatsAppWebhookPayload } from "./service.js";

const router = Router();

/**
 * Meta WhatsApp Cloud API webhook.
 *
 * Configure in Meta Developer Console:
 *   Callback URL:  {API_URL}/api/v1/public/webhooks/whatsapp
 *   Verify token:  WHATSAPP_WEBHOOK_VERIFY_TOKEN
 *   App secret:    WHATSAPP_APP_SECRET  (for X-Hub-Signature-256)
 *
 * Subscribe to the `messages` field on the WhatsApp Business Account.
 */
router.get("/", (req, res) => {
  if (!isWhatsAppWebhookConfigured()) {
    res.status(503).type("text/plain").send("WhatsApp webhook is not configured");
    return;
  }
  const challenge = verifyMetaSubscribeChallenge(req.query || {});
  if (challenge == null) {
    res.status(403).type("text/plain").send("Forbidden");
    return;
  }
  res.status(200).type("text/plain").send(challenge);
});

router.post("/", async (req, res) => {
  if (!isWhatsAppWebhookConfigured()) {
    // Acknowledge without processing so misconfigured deploys don't loop forever.
    res.status(503).json({
      success: false,
      error: {
        code: "WEBHOOK_NOT_CONFIGURED",
        message: "WhatsApp webhook credentials are not configured",
      },
    });
    return;
  }

  const signature =
    req.get("X-Hub-Signature-256") || req.get("x-hub-signature-256");
  const rawBody = req.rawBody;
  if (!rawBody || !verifyMetaSignature(rawBody, signature)) {
    console.warn("[whatsapp-webhook] rejected: invalid signature");
    res.status(401).json({
      success: false,
      error: { code: "INVALID_SIGNATURE", message: "Unauthorized" },
    });
    return;
  }

  // Optional: only accept events for the configured business phone number id.
  const expectedPhoneId = String(env.whatsappPhoneNumberId || "").trim();
  if (expectedPhoneId) {
    const entries = Array.isArray(req.body?.entry) ? req.body.entry : [];
    for (const entry of entries) {
      const changes = Array.isArray(entry?.changes) ? entry.changes : [];
      for (const change of changes) {
        const phoneId = change?.value?.metadata?.phone_number_id;
        if (phoneId && String(phoneId) !== expectedPhoneId) {
          console.warn("[whatsapp-webhook] ignored: phone_number_id mismatch");
          res.status(200).json({ success: true, data: { ignored: true } });
          return;
        }
      }
    }
  }

  try {
    const outcome = await processWhatsAppWebhookPayload(req.body, req);
    if (outcome.retryableFailure) {
      // Meta retries on non-2xx; idempotency table prevents duplicate customers.
      res.status(500).json({
        success: false,
        error: {
          code: "WEBHOOK_PROCESSING_FAILED",
          message: "Temporary processing failure",
        },
      });
      return;
    }
    res.status(200).json({ success: true, data: { results: outcome.results } });
  } catch (err) {
    console.error(
      "[whatsapp-webhook] unhandled",
      err?.message || err,
    );
    res.status(500).json({
      success: false,
      error: {
        code: "WEBHOOK_ERROR",
        message: "Temporary processing failure",
      },
    });
  }
});

export default router;
