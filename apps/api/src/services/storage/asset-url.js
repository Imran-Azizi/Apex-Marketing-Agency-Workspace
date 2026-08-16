/**
 * Shared helpers for resolving displayable asset URLs from stored metadata.
 */

export function asMetaObject(meta) {
  return meta && typeof meta === "object" && !Array.isArray(meta) ? meta : null;
}

/** Prefer upload-time CDN URL stored on ClientAsset / ProjectFile meta. */
export function storedAssetUrl(meta) {
  const root = asMetaObject(meta);
  if (!root) return null;
  const storage = asMetaObject(root.storage);
  const candidates = [
    storage?.url,
    storage?.secureUrl,
    storage?.secure_url,
    root.url,
    root.secureUrl,
    root.secure_url,
    root.imageUrl,
  ];
  for (const value of candidates) {
    if (typeof value === "string" && /^https?:\/\//i.test(value.trim())) {
      return value.trim();
    }
  }
  return null;
}
