/**
 * Shared rules for manager/customer content-version workflows.
 */

export const CONTENT_SECTIONS = Object.freeze(['scenario', 'narration', 'storyboard']);

export function versionHasContent(version) {
  return Boolean(version?.scenario || version?.narration || version?.storyboard);
}

export function versionHasSection(version, section) {
  if (!version || !CONTENT_SECTIONS.includes(section)) return false;
  return version[section] != null;
}

export function presentSections(version) {
  return CONTENT_SECTIONS.filter((section) => versionHasSection(version, section));
}

function asObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

/** Normalized manager section-confirm state for API responses. */
export function getManagerSectionConfirm(version) {
  const extras = asObject(version?.extras);
  const raw = asObject(extras.managerSectionConfirm);
  const sections = {};
  for (const section of CONTENT_SECTIONS) {
    const entry = asObject(raw[section]);
    sections[section] = {
      confirmed: Boolean(entry.confirmed),
      at: entry.at || null,
      byUserId: entry.byUserId || null,
    };
  }
  return {
    ...sections,
    releasedAt: raw.releasedAt || null,
    releasedById: raw.releasedById || null,
  };
}

export function requiredSectionsConfirmed(version) {
  const present = presentSections(version);
  if (!present.length) return false;
  const confirm = getManagerSectionConfirm(version);
  return present.every((section) => confirm[section]?.confirmed === true);
}

export function canToggleSectionConfirm(version) {
  if (!version || !versionHasContent(version)) return false;
  if (version.status === 'APPROVED' && version.isLocked) return false;
  return true;
}

export function canReleaseVersionForProduction(version) {
  if (!canToggleSectionConfirm(version)) return false;
  return requiredSectionsConfirmed(version);
}

/**
 * Whether a manager may send this version to the customer portal for approval.
 */
export function canManagerSendToCustomer(version) {
  if (!version) return false;
  if (!versionHasContent(version)) return false;
  if (version.status === 'APPROVED' && version.isLocked) return false;
  if (version.status === 'PENDING_CUSTOMER_APPROVAL' && version.publishedToClient) {
    return false;
  }
  return true;
}

/**
 * Whether a manager may delete a draft version.
 */
export function canManagerDeleteVersion(version) {
  if (!version) return false;
  if (version.publishedToClient) return false;
  if (version.status === 'APPROVED') return false;
  if (version.status === 'PENDING_CUSTOMER_APPROVAL') return false;
  return true;
}

/** Attach UI-friendly confirm fields without mutating Prisma row identity. */
export function withManagerSectionConfirm(version) {
  if (!version) return version;
  return {
    ...version,
    managerSectionConfirm: getManagerSectionConfirm(version),
  };
}
