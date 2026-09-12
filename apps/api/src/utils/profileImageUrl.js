import { storage } from "../services/storage.js";

/** Resolve Bunny CDN (or /files fallback) URL for a stored profile image key. */
export function profileImageUrlFor(key) {
  if (!key) return null;
  try {
    return storage.publicUrl(key);
  } catch (err) {
    if (process.env.NODE_ENV !== "production") {
      console.warn(
        "[profileImage] url resolve failed:",
        key,
        err?.message || err,
      );
    }
    return null;
  }
}
