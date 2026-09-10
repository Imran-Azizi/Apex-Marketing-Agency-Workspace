/**
 * Storage driver contract. Application code depends on `storage` (the facade),
 * never on Bunny.net HTTP details.
 *
 * The Bunny driver implements:
 *   publicUrl(storageKey, opts?)
 *   resolveDeliveryUrl?(storageKey, opts?)
 *   saveBuffer(buffer, opts)
 *   saveFile?(filePath, opts)
 *   exists(storageKey)
 *   head(storageKey) -> { size, contentType, ... }
 *   openReadStream(storageKey, { start, end }?)
 *   deleteObject(storageKey)
 *   readBuffer(storageKey)
 *   createPresignedGetUrl(storageKey, ttl?)
 */

export const STORAGE_PROVIDERS = Object.freeze({
  BUNNY: "bunny",
});
