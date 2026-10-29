#!/usr/bin/env node
/**
 * Generate Web Push VAPID keys for apps/api/.env (production or local).
 *
 * Usage (from repo root or apps/api):
 *   npm run vapid:generate -w @apex/api
 *
 * Paste the printed lines into apps/api/.env on the VPS, then:
 *   pm2 restart apex-api
 *
 * Keep the private key secret. Regenerating keys invalidates existing
 * browser subscriptions — generate once per environment and keep them.
 */
import webpush from "web-push";

const keys = webpush.generateVAPIDKeys();
const subject =
  process.env.VAPID_SUBJECT?.trim() || "mailto:admin@smartapex.tech";

process.stdout.write(`# Web Push (VAPID) — out-of-app notifications
# Generated ${new Date().toISOString()}
VAPID_PUBLIC_KEY=${keys.publicKey}
VAPID_PRIVATE_KEY=${keys.privateKey}
VAPID_SUBJECT=${subject}
`);
