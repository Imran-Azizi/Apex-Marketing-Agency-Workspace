/**
 * Shared rules for manager/customer content-version workflows.
 */

export function versionHasContent(version) {
  return Boolean(version?.scenario || version?.narration || version?.storyboard);
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
 * Whether a manager may edit version content in the workspace.
 */
export function canManagerEditVersion(version) {
  if (!version) return false;
  if (version.status === 'APPROVED') return false;
  if (version.status === 'PENDING_CUSTOMER_APPROVAL' && version.publishedToClient) {
    return false;
  }
  if (version.status === 'REVISION_REQUESTED' && version.isLocked) return false;
  if (version.isLocked && version.publishedToClient) return false;
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
