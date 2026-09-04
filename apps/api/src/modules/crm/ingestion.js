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
} from './pipeline.js';
import { recordCrmActivity } from './activity.js';
import { getCustomerPersonName } from '../../utils/crmCustomerName.js';
import {
  notifyManagersOnce,
  buildLeadCreatedNotification,
  createNotificationOnce,
} from '../../services/notifications.js';

export const UNNAMED_LEAD = 'سرنخ جدید';

function fallbackName(personName, source) {
  const name = String(personName || '').trim();
  if (name) return name;
  if (source === 'WHATSAPP') return 'سرنخ واتساپ';
  if (source === 'WEBSITE' || source === 'WEBSITE_CONTACT') return 'سرنخ وب‌سایت';
  return UNNAMED_LEAD;
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
      const patch = {
        lastContactAt: now,
      };
      if ((!existing.personName || existing.personName === UNNAMED_LEAD || existing.personName.startsWith('سرنخ '))
        && personName?.trim()) {
        patch.personName = personName.trim();
      }
      if (!existing.companyName && companyName) patch.companyName = companyName;
      if (!existing.email && email) patch.email = email;
      if (!existing.phone && phone) patch.phone = phone;
      if (!existing.phoneCountryIso && parsed.country) patch.phoneCountryIso = parsed.country;

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
        title: source === 'WHATSAPP' ? 'پیام واتساپ دریافت شد' : 'تعامل جدید',
        notify: false,
        touchLastContact: true,
      });

      return { customer: updated, created: false, duplicate: true };
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
        return { customer: survivor, created: false, duplicate: true };
      }
    }

    const customerCode = await allocateCustomerCode(tx);
    const baseData = {
      customerCode,
      personName: name,
      companyName: companyName || null,
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

    const created = existing
      ? await tx.crmCustomer.update({
          where: { id: existing.id },
          data: { ...baseData, deletedAt: null, convertedAt: null },
        })
      : await tx.crmCustomer.create({ data: baseData });

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
      type: source === 'WHATSAPP' ? ACTIVITY_TYPES.WHATSAPP_MESSAGE : ACTIVITY_TYPES.LEAD_CREATED,
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
        type: source === 'WHATSAPP' ? ACTIVITY_TYPES.WHATSAPP_MESSAGE : ACTIVITY_TYPES.CONTACT_FORM,
        title: source === 'WHATSAPP' ? 'پیام واتساپ دریافت شد' : 'پیام فرم تماس',
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

    return { customer: created, created: true, duplicate: false };
  });

  return result;
}

export async function ingestWhatsAppMessage({ from, text, name, profileName }) {
  return ingestLead({
    source: 'WHATSAPP',
    whatsapp: from,
    personName: name || profileName || '',
    message: text || '',
    interactionType: 'WHATSAPP',
    meta: { provider: 'whatsapp' },
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
  return ingestLead({
    source: 'WEBSITE',
    whatsapp: phone,
    phone,
    personName: name,
    email,
    companyName: company,
    message: [subject, message].filter(Boolean).join('\n\n'),
    relatedType: 'ContactMessage',
    relatedId: contactMessageId,
    interactionType: 'MESSAGE',
    meta: { subject },
  });
}
