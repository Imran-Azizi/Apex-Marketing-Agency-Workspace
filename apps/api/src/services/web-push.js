import webpush from 'web-push';
import { prisma } from '../db/prisma.js';
import { env } from '../config/env.js';

let vapidConfigured = false;

function ensureVapid() {
  if (vapidConfigured) return true;
  if (!env.vapidPublicKey || !env.vapidPrivateKey) return false;
  webpush.setVapidDetails(
    env.vapidSubject,
    env.vapidPublicKey,
    env.vapidPrivateKey,
  );
  vapidConfigured = true;
  return true;
}

export function isWebPushConfigured() {
  return Boolean(env.vapidPublicKey && env.vapidPrivateKey);
}

export function getVapidPublicKey() {
  return env.vapidPublicKey || null;
}

function absoluteUrl(link) {
  if (!link) return env.webUrl;
  if (/^https?:\/\//i.test(link)) return link;
  const path = link.startsWith('/') ? link : `/${link}`;
  return `${env.webUrl}${path}`;
}

function recipientFilter({ userId = null, portalAccountId = null }) {
  if (userId) return { userId };
  if (portalAccountId) return { portalAccountId };
  return null;
}

/**
 * Persist or refresh a browser push subscription for the signed-in recipient.
 */
export async function upsertPushSubscription({
  userId = null,
  portalAccountId = null,
  endpoint,
  p256dh,
  auth,
  userAgent = null,
}) {
  if (!endpoint || !p256dh || !auth) {
    throw new Error('endpoint, p256dh and auth are required');
  }
  if (!userId && !portalAccountId) {
    throw new Error('userId or portalAccountId is required');
  }

  return prisma.pushSubscription.upsert({
    where: { endpoint },
    create: {
      userId,
      portalAccountId,
      endpoint,
      p256dh,
      auth,
      userAgent: userAgent || null,
      lastUsedAt: new Date(),
    },
    update: {
      userId,
      portalAccountId,
      p256dh,
      auth,
      userAgent: userAgent || null,
      lastUsedAt: new Date(),
    },
  });
}

export async function deletePushSubscription({
  userId = null,
  portalAccountId = null,
  endpoint,
}) {
  const where = { endpoint };
  if (userId) where.userId = userId;
  if (portalAccountId) where.portalAccountId = portalAccountId;
  const result = await prisma.pushSubscription.deleteMany({ where });
  return result.count;
}

export async function countPushSubscriptions({
  userId = null,
  portalAccountId = null,
}) {
  const filter = recipientFilter({ userId, portalAccountId });
  if (!filter) return 0;
  return prisma.pushSubscription.count({ where: filter });
}

async function removeGoneSubscription(id) {
  try {
    await prisma.pushSubscription.delete({ where: { id } });
  } catch {
    // already removed
  }
}

/**
 * Send a Web Push to every device registered for this recipient.
 * Never throws to callers — failures are logged and stale endpoints cleaned up.
 */
export async function sendWebPushToRecipient({
  userId = null,
  portalAccountId = null,
  title,
  body = null,
  link = null,
  notificationId = null,
  tag = null,
}) {
  if (!ensureVapid()) return { sent: 0, skipped: true, reason: 'not_configured' };

  const filter = recipientFilter({ userId, portalAccountId });
  if (!filter) return { sent: 0, skipped: true, reason: 'no_recipient' };

  const subscriptions = await prisma.pushSubscription.findMany({
    where: filter,
  });
  if (!subscriptions.length) {
    return { sent: 0, skipped: true, reason: 'no_subscriptions' };
  }

  const payload = JSON.stringify({
    title: String(title || 'اعلان جدید'),
    body: body ? String(body).slice(0, 280) : '',
    url: absoluteUrl(link),
    tag: tag || (notificationId ? `apex-notification-${notificationId}` : 'apex-notification'),
    notificationId: notificationId || null,
  });

  let sent = 0;
  await Promise.all(
    subscriptions.map(async (sub) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: { p256dh: sub.p256dh, auth: sub.auth },
          },
          payload,
          {
            TTL: 60 * 60 * 12,
            urgency: 'normal',
          },
        );
        sent += 1;
        await prisma.pushSubscription
          .update({
            where: { id: sub.id },
            data: { lastUsedAt: new Date() },
          })
          .catch(() => {});
      } catch (err) {
        const status = err?.statusCode || err?.status;
        if (status === 404 || status === 410) {
          await removeGoneSubscription(sub.id);
          return;
        }
        console.warn(
          '[web-push] send failed:',
          status || err?.message || err,
        );
      }
    }),
  );

  return { sent, skipped: false };
}

/**
 * Fire-and-forget after a notification row is created.
 * Uses setImmediate so the HTTP/DB path is not blocked.
 */
export function scheduleWebPushForNotification({
  userId = null,
  portalAccountId = null,
  title,
  body = null,
  link = null,
  notificationId = null,
}) {
  if (!isWebPushConfigured()) return;
  if (!userId && !portalAccountId) return;

  // Short delay so nested Prisma transactions can commit before push fans out.
  setTimeout(() => {
    void sendWebPushToRecipient({
      userId,
      portalAccountId,
      title,
      body,
      link,
      notificationId,
    }).catch((err) => {
      console.warn('[web-push] schedule failed:', err?.message || err);
    });
  }, 400);
}
