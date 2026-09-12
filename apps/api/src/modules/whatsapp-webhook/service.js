/**
 * Process Meta WhatsApp Cloud API inbound webhooks → CRM lead ingest.
 */

import { prisma } from "../../db/prisma.js";
import { writeAudit } from "../../middleware/audit.js";
import { ingestWhatsAppMessage } from "../crm/ingestion.js";
import {
  WHATSAPP_INBOUND_STATUS,
  extractInboundMessages,
  resolveInboundLeadSource,
} from "./meta.js";

function isUniqueViolation(err) {
  return err?.code === "P2002";
}

/**
 * Claim an inbound message for processing (idempotent on providerMsgId).
 * @returns {{ event: object, skip: boolean, reason?: string }}
 */
async function claimInboundEvent(msg) {
  try {
    const event = await prisma.whatsAppInboundEvent.create({
      data: {
        providerMsgId: msg.providerMsgId,
        fromWaId: msg.fromWaId,
        displayName: msg.displayName,
        textPreview: msg.textPreview,
        sourceHint: resolveInboundLeadSource(msg.text),
        status: WHATSAPP_INBOUND_STATUS.PROCESSING,
      },
    });
    return { event, skip: false };
  } catch (err) {
    if (!isUniqueViolation(err)) throw err;
    const existing = await prisma.whatsAppInboundEvent.findUnique({
      where: { providerMsgId: msg.providerMsgId },
    });
    if (!existing) throw err;

    if (
      existing.status === WHATSAPP_INBOUND_STATUS.PROCESSED ||
      existing.status === WHATSAPP_INBOUND_STATUS.DUPLICATE ||
      existing.status === WHATSAPP_INBOUND_STATUS.IGNORED
    ) {
      return { event: existing, skip: true, reason: "already_processed" };
    }

    // Failed earlier — allow safe retry by reclaiming.
    if (existing.status === WHATSAPP_INBOUND_STATUS.FAILED) {
      const event = await prisma.whatsAppInboundEvent.update({
        where: { id: existing.id },
        data: {
          status: WHATSAPP_INBOUND_STATUS.PROCESSING,
          errorCode: null,
          errorMessage: null,
          displayName: msg.displayName || existing.displayName,
          textPreview: msg.textPreview || existing.textPreview,
          sourceHint: resolveInboundLeadSource(msg.text) || existing.sourceHint,
        },
      });
      return { event, skip: false };
    }

    // Still PROCESSING / RECEIVED from a concurrent delivery — treat as duplicate.
    return { event: existing, skip: true, reason: "in_flight" };
  }
}

async function markEvent(eventId, data) {
  return prisma.whatsAppInboundEvent.update({
    where: { id: eventId },
    data: {
      ...data,
      updatedAt: new Date(),
    },
  });
}

async function processOneMessage(msg, req) {
  const claim = await claimInboundEvent(msg);
  if (claim.skip) {
    await writeAudit({
      userId: null,
      action: "WHATSAPP_WEBHOOK_DUPLICATE",
      entityType: "WhatsAppInboundEvent",
      entityId: claim.event.id,
      after: {
        providerMsgId: msg.providerMsgId,
        reason: claim.reason,
        status: claim.event.status,
      },
      req,
    });
    return {
      providerMsgId: msg.providerMsgId,
      status: "duplicate",
      customerId: claim.event.crmCustomerId || null,
    };
  }

  const event = claim.event;
  const source = resolveInboundLeadSource(msg.text);

  try {
    const result = await ingestWhatsAppMessage({
      from: msg.fromWaId,
      text: msg.text || undefined,
      name: msg.displayName || undefined,
      profileName: msg.displayName || undefined,
      source,
      meta: {
        provider: "meta_cloud",
        providerMsgId: msg.providerMsgId,
        messageType: msg.type,
        phoneNumberId: msg.phoneNumberId,
        inboundEventId: event.id,
      },
    });

    await markEvent(event.id, {
      status: result.created
        ? WHATSAPP_INBOUND_STATUS.PROCESSED
        : WHATSAPP_INBOUND_STATUS.DUPLICATE,
      crmCustomerId: result.customer.id,
      normalizedWa: result.customer.normalizedWhatsapp,
      processedAt: new Date(),
      sourceHint: source,
    });

    await writeAudit({
      userId: null,
      action: result.created
        ? "WHATSAPP_WEBHOOK_LEAD_CREATE"
        : "WHATSAPP_WEBHOOK_LEAD_MATCH",
      entityType: "CrmCustomer",
      entityId: result.customer.id,
      after: {
        created: result.created,
        duplicate: result.duplicate,
        source,
        providerMsgId: msg.providerMsgId,
        customerCode: result.customer.customerCode,
      },
      req,
    });

    return {
      providerMsgId: msg.providerMsgId,
      status: result.created ? "created" : "matched",
      customerId: result.customer.id,
      customerCode: result.customer.customerCode,
    };
  } catch (err) {
    const code = err?.code || "INGEST_FAILED";
    const message = String(err?.message || "WhatsApp ingest failed").slice(
      0,
      500,
    );
    await markEvent(event.id, {
      status: WHATSAPP_INBOUND_STATUS.FAILED,
      errorCode: String(code).slice(0, 80),
      errorMessage: message,
    });
    await writeAudit({
      userId: null,
      action: "WHATSAPP_WEBHOOK_LEAD_FAILED",
      entityType: "WhatsAppInboundEvent",
      entityId: event.id,
      after: {
        providerMsgId: msg.providerMsgId,
        errorCode: code,
      },
      req,
    });
    console.error("[whatsapp-webhook] ingest failed", {
      providerMsgId: msg.providerMsgId,
      code,
      message,
    });
    throw err;
  }
}

/**
 * Handle a verified Meta webhook POST body.
 * Returns { ok, results, retryableFailure }.
 */
export async function processWhatsAppWebhookPayload(payload, req) {
  const messages = extractInboundMessages(payload);
  if (messages.length === 0) {
    await writeAudit({
      userId: null,
      action: "WHATSAPP_WEBHOOK_RECEIVED",
      entityType: "WhatsAppWebhook",
      entityId: null,
      after: { messages: 0, ignored: true },
      req,
    });
    return { ok: true, results: [], retryableFailure: false };
  }

  await writeAudit({
    userId: null,
    action: "WHATSAPP_WEBHOOK_RECEIVED",
    entityType: "WhatsAppWebhook",
    entityId: null,
    after: { messages: messages.length },
    req,
  });

  const results = [];
  let retryableFailure = false;

  for (const msg of messages) {
    try {
      results.push(await processOneMessage(msg, req));
    } catch {
      retryableFailure = true;
      results.push({
        providerMsgId: msg.providerMsgId,
        status: "failed",
      });
    }
  }

  return { ok: !retryableFailure, results, retryableFailure };
}

export const whatsappWebhookService = {
  processWhatsAppWebhookPayload,
};
