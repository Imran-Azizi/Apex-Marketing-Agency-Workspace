/**
 * Lead ingestion boundary for WhatsApp, website contact, and future sources.
 * Duplicate detection is always on normalized international WhatsApp/phone.
 */

import { prisma } from '../../db/prisma.js';
import { AppError } from '../../utils/response.js';
import { parseInternationalPhone, getWhatsappLookupKeys, WHATSAPP_VALIDATION_MESSAGE } from '../../utils/whatsappNormalize.js';
import { allocateCustomerCode } from './customerCode.js';
import { applyCrmEvent } from './sync.js';
import {
  ACTIVITY_TYPES,
  CRM_EVENTS,
  canonicalizeStage,
} from './pipeline.js';
import { recordCrmActivity } from './activity.js';
import { getCustomerPersonName } from '../../utils/crmCustomerName.js';
import {
  notifyManagersOnce,
  buildLeadCreatedNotification,
  createNotificationOnce,
} from '../../services/notifications.js';

export const UNNAMED_LEAD = 'سرنخ جدید';
export const WHATSAPP_CUSTOMER_FALLBACK = 'مشتری واتساپ';

/** Finished / left sales — inbound contact must surface again as سرنخ. */
const REOPEN_STAGES = new Set(['DELIVERED', 'LOST_CANCELED']);

function isWhatsAppSource(source) {
  return source === 'WHATSAPP' || source === 'WHATSAPP_WEBSITE';
}

function fallbackName(personName, source) {
  const name = String(personName || '').trim();
  if (name) return name;
  if (isWhatsAppSource(source)) return WHATSAPP_CUSTOMER_FALLBACK;
  if (source === 'WEBSITE' || source === 'WEBSITE_CONTACT') return 'سرنخ وب‌سایت';
  return UNNAMED_LEAD;
}

function shouldReopenForInbound(customer) {
  if (!customer || customer.deletedAt) return false;
  if (customer.convertedAt) return true;
  return REOPEN_STAGES.has(canonicalizeStage(customer.pipelineStage));
}

function buildExistingPatch(existing, {
  personName,
  companyName,
  jobTitle,
  email,
  phone,
  parsed,
  now,
}) {
  const patch = {
    lastContactAt: now,
  };
  if ((!existing.personName || existing.personName === UNNAMED_LEAD || existing.personName === WHATSAPP_CUSTOMER_FALLBACK || existing.personName.startsWith('سرنخ '))
    && personName?.trim()) {
    patch.personName = personName.trim();
  }
  if (!existing.companyName && companyName) patch.companyName = companyName;
  if (!existing.jobTitle && jobTitle) patch.jobTitle = jobTitle;
  if (!existing.email && email) patch.email = email;
  if (!existing.phone && phone) patch.phone = phone;
  if (!existing.phoneCountryIso && parsed.country) patch.phoneCountryIso = parsed.country;
  return patch;
}

async function findByNormalized(tx, input) {
  const keys = getWhatsappLookupKeys(input);
  return tx.crmCustomer.findFirst({
    where: { normalizedWhatsapp: { in: keys } },
  });
}

/**
 * Create-or-attach a CRM lead from an inbound channel.
 * Never creates a second lead for the same normalized number.
 */
export async function ingestLead({
  source,
  whatsapp,
  personName,
  companyName,
  jobTitle,
  email,
  phone,
  notes,
  message,
  actorId = null,
  salesOwnerId = null,
  meta = null,
  relatedType = null,
  relatedId = null,
  interactionType = 'MESSAGE',
}) {
  let parsed;
  try {
    parsed = parseInternationalPhone(whatsapp || phone);
  } catch (err) {
    if (err instanceof AppError) throw err;
    throw new AppError(WHATSAPP_VALIDATION_MESSAGE, 400, 'INVALID_WHATSAPP');
  }

  const name = fallbackName(personName, source);
  const now = new Date();

  const result = await prisma.$transaction(async (tx) => {
    const existing = await findByNormalized(tx, whatsapp || phone);

    if (existing && !existing.deletedAt) {
      const patch = buildExistingPatch(existing, {
        personName,
        companyName,
        jobTitle,
        email,
        phone,
        parsed,
        now,
      });

      // Same phone on a delivered / transferred customer must re-enter CRM و فروش
      // as سرنخ جدید — otherwise website/WhatsApp traffic is invisible in sales.
      if (shouldReopenForInbound(existing)) {
        const previousStage = canonicalizeStage(existing.pipelineStage);
        const reopened = await tx.crmCustomer.update({
          where: { id: existing.id },
          data: {
            ...patch,
            convertedAt: null,
            pipelineStage: 'NEW_LEAD',
            lostReason: null,
            ...(notes && !existing.notes ? { notes } : {}),
          },
        });

        const openOpp = await tx.opportunity.findFirst({
          where: {
            crmCustomerId: existing.id,
            deletedAt: null,
            pipelineStage: { not: 'LOST_CANCELED' },
          },
          orderBy: { updatedAt: 'desc' },
        });
        if (openOpp) {
          await tx.opportunity.update({
            where: { id: openOpp.id },
            data: { pipelineStage: 'NEW_LEAD', lostReason: null },
          });
        } else {
          await tx.opportunity.create({
            data: {
              crmCustomerId: existing.id,
              title: `فرصت جدید — ${getCustomerPersonName(reopened)}`,
              pipelineStage: 'NEW_LEAD',
              lostReason: null,
            },
          });
        }

        const formName = String(personName || '').trim();
        const detail = message || notes || null;
        const reopenBody = [
          formName && formName !== reopened.personName
            ? `نام در فرم: ${formName}`
            : null,
          detail,
        ]
          .filter(Boolean)
          .join('\n\n');

        await recordCrmActivity(tx, {
          crmCustomerId: existing.id,
          type: isWhatsAppSource(source)
            ? ACTIVITY_TYPES.WHATSAPP_MESSAGE
            : ACTIVITY_TYPES.CONTACT_FORM,
          title: isWhatsAppSource(source)
            ? 'پیام واتساپ — بازگشت به فروش'
            : 'درخواست وب‌سایت — سرنخ مجدد',
          body: reopenBody || `منبع: ${source}`,
          previousStatus: previousStage,
          newStatus: 'NEW_LEAD',
          actorId,
          actorType: actorId ? 'USER' : 'SYSTEM',
          source,
          relatedType,
          relatedId,
          meta: {
            channel: source,
            reopened: true,
            previousConvertedAt: existing.convertedAt || null,
            ...(meta || {}),
          },
        });

        await notifyManagersOnce(
          {
            ...buildLeadCreatedNotification({
              customerId: reopened.id,
              personName: reopened.personName,
              phone: parsed.e164,
              customerCode: reopened.customerCode,
              source,
            }),
            eventKey: `lead.reopened:${reopened.id}:${now.toISOString()}`,
            title: 'سرنخ مجدد از تماس ورودی',
          },
          tx,
        );

        return {
          customer: reopened,
          created: true,
          duplicate: true,
          reopened: true,
        };
      }

      const updated = await tx.crmCustomer.update({
        where: { id: existing.id },
        data: patch,
      });

      await applyCrmEvent(tx, {
        customerId: existing.id,
        event: CRM_EVENTS.INTERACTION,
        actorId,
        actorType: actorId ? 'USER' : 'SYSTEM',
        source,
        interactionType,
        note: message || notes,
        body: message || notes,
        relatedType,
        relatedId,
        meta: {
          channel: source,
          ...(meta || {}),
        },
        title: isWhatsAppSource(source) ? 'پیام واتساپ دریافت شد' : 'تعامل جدید',
        notify: false,
        touchLastContact: true,
      });

      return { customer: updated, created: false, duplicate: true, reopened: false };
    }

    if (existing?.deletedAt && existing.notes?.startsWith('MERGED_INTO:')) {
      const survivorId = existing.notes.slice('MERGED_INTO:'.length);
      const survivor = await tx.crmCustomer.findFirst({
        where: { id: survivorId, deletedAt: null },
      });
      if (survivor) {
        await applyCrmEvent(tx, {
          customerId: survivor.id,
          event: CRM_EVENTS.INTERACTION,
          source,
          interactionType,
          note: message || notes,
          body: message || notes,
          relatedType,
          relatedId,
          meta: { channel: source, mergedFrom: existing.id, ...(meta || {}) },
          notify: false,
          touchLastContact: true,
        });
        return { customer: survivor, created: false, duplicate: true, reopened: false };
      }
    }

    const customerCode = await allocateCustomerCode(tx);
    const baseData = {
      customerCode,
      personName: name,
      companyName: companyName || null,
      jobTitle: jobTitle || null,
      phone: phone || parsed.e164,
      whatsappRaw: parsed.e164,
      normalizedWhatsapp: parsed.digits,
      phoneCountryIso: parsed.country,
      email: email || null,
      source: source || 'OTHER',
      salesOwnerId: salesOwnerId || null,
      pipelineStage: 'NEW_LEAD',
      portalStatus: 'NOT_ELIGIBLE',
      notes: notes || null,
      lastContactAt: now,
      lostReason: null,
    };

    let created;
    try {
      created = existing
        ? await tx.crmCustomer.update({
            where: { id: existing.id },
            data: { ...baseData, deletedAt: null, convertedAt: null },
          })
        : await tx.crmCustomer.create({ data: baseData });
    } catch (err) {
      // Concurrent webhook create on same normalizedWhatsapp.
      if (err?.code === 'P2002') {
        const raced = await findByNormalized(tx, whatsapp || phone);
        if (raced && !raced.deletedAt) {
          const updated = await tx.crmCustomer.update({
            where: { id: raced.id },
            data: { lastContactAt: now },
          });
          await applyCrmEvent(tx, {
            customerId: raced.id,
            event: CRM_EVENTS.INTERACTION,
            actorId,
            actorType: actorId ? 'USER' : 'SYSTEM',
            source,
            interactionType,
            note: message || notes,
            body: message || notes,
            relatedType,
            relatedId,
            meta: { channel: source, race: true, ...(meta || {}) },
            title: isWhatsAppSource(source) ? 'پیام واتساپ دریافت شد' : 'تعامل جدید',
            notify: false,
            touchLastContact: true,
          });
          return { customer: updated, created: false, duplicate: true, reopened: false };
        }
      }
      throw err;
    }

    await tx.opportunity.create({
      data: {
        crmCustomerId: created.id,
        title: `فرصت اولیه — ${getCustomerPersonName(created)}`,
        pipelineStage: 'NEW_LEAD',
        lostReason: null,
      },
    });

    await recordCrmActivity(tx, {
      crmCustomerId: created.id,
      type: isWhatsAppSource(source)
        ? ACTIVITY_TYPES.WHATSAPP_MESSAGE
        : ACTIVITY_TYPES.LEAD_CREATED,
      title: 'سرنخ ایجاد شد',
      body: message || notes || `منبع: ${source}`,
      newStatus: 'NEW_LEAD',
      actorId,
      actorType: actorId ? 'USER' : 'SYSTEM',
      source,
      relatedType,
      relatedId,
      meta: { channel: source, customerCode, ...(meta || {}) },
    });

    if (message) {
      await recordCrmActivity(tx, {
        crmCustomerId: created.id,
        type: isWhatsAppSource(source)
          ? ACTIVITY_TYPES.WHATSAPP_MESSAGE
          : ACTIVITY_TYPES.CONTACT_FORM,
        title: isWhatsAppSource(source)
          ? 'پیام واتساپ دریافت شد'
          : 'پیام فرم تماس',
        body: message,
        actorId,
        actorType: 'SYSTEM',
        source,
        relatedType,
        relatedId,
      });
    }

    await notifyManagersOnce(
      buildLeadCreatedNotification({
        customerId: created.id,
        personName: created.personName,
        phone: parsed.e164,
        customerCode: created.customerCode,
        source,
      }),
      tx,
    );

    if (salesOwnerId) {
      await createNotificationOnce(
        {
          userId: salesOwnerId,
          eventKey: `lead.assigned:${created.id}:${salesOwnerId}`,
          title: 'سرنخ جدید به شما اختصاص یافت',
          body: `${created.personName} — ${created.customerCode}`,
          link: `/crm/${created.id}`,
          meta: { type: 'LEAD_ASSIGNED', customerId: created.id },
        },
        tx,
      );
    }

    return { customer: created, created: true, duplicate: false, reopened: false };
  });

  return result;
}

export async function ingestWhatsAppMessage({
  from,
  text,
  name,
  profileName,
  source = 'WHATSAPP',
  meta = null,
}) {
  const leadSource =
    source === 'WHATSAPP_WEBSITE' ? 'WHATSAPP_WEBSITE' : 'WHATSAPP';
  return ingestLead({
    source: leadSource,
    whatsapp: from,
    personName: name || profileName || '',
    message: text || '',
    interactionType: 'WHATSAPP',
    meta: { provider: 'whatsapp', ...(meta || {}) },
  });
}

export async function ingestWebsiteContact({
  name,
  email,
  phone,
  company,
  subject,
  message,
  contactMessageId,
}) {
  const detail = [subject, message].filter(Boolean).join("\n\n");
  return ingestLead({
    source: "WEBSITE_CONTACT",
    whatsapp: phone,
    phone,
    personName: name,
    email,
    companyName: company,
    notes: detail || null,
    message: detail || null,
    relatedType: contactMessageId ? "ContactMessage" : null,
    relatedId: contactMessageId || null,
    interactionType: "MESSAGE",
    meta: { subject: subject || null, channel: "public_contact_form" },
  });
}

/**
 * Public website WhatsApp CTA lead capture (form before opening wa.me).
 * Source is WHATSAPP_WEBSITE so CRM و فروش shows the correct attribution.
 */
export async function ingestWhatsAppWebsiteLead({
  name,
  whatsapp,
  companyName,
  jobTitle,
  message,
}) {
  const detailParts = [
    jobTitle ? `موقف: ${jobTitle}` : null,
    companyName ? `شرکت: ${companyName}` : null,
    message || null,
  ].filter(Boolean);

  return ingestLead({
    source: "WHATSAPP_WEBSITE",
    whatsapp,
    personName: name,
    companyName: companyName || null,
    jobTitle: jobTitle || null,
    notes: detailParts.length ? detailParts.join("\n") : null,
    message: detailParts.length ? detailParts.join("\n") : null,
    interactionType: "WHATSAPP",
    meta: { channel: "public_whatsapp_cta" },
  });
}
