export type ContentVersionLike = {
  id?: string;
  status: string;
  publishedToClient?: boolean;
  publishedAt?: string | null;
  isLocked?: boolean;
  scenario?: unknown;
  narration?: unknown;
  storyboard?: unknown;
};

export function versionHasContent(version: ContentVersionLike | null | undefined) {
  if (!version) return false;
  return (
    version.scenario != null ||
    version.narration != null ||
    version.storyboard != null
  );
}

/** Manager can send this version to the customer for approval. */
export function canSendVersionToCustomer(version: ContentVersionLike | null | undefined) {
  if (!version || !versionHasContent(version)) return false;
  if (version.status === "APPROVED" && version.isLocked) return false;
  if (
    version.status === "PENDING_CUSTOMER_APPROVAL" &&
    version.publishedToClient
  ) {
    return false;
  }
  return true;
}

export function canEditContentVersion(version: ContentVersionLike | null | undefined) {
  if (!version) return false;
  if (version.status === "APPROVED") return false;
  if (
    version.status === "PENDING_CUSTOMER_APPROVAL" &&
    version.publishedToClient
  ) {
    return false;
  }
  if (version.status === "REVISION_REQUESTED" && version.isLocked) return false;
  if (version.isLocked && version.publishedToClient) return false;
  return true;
}

export function versionSendBlockReason(
  version: ContentVersionLike | null | undefined,
): string | null {
  if (!version) return "نسخه‌ای انتخاب نشده است.";
  if (!versionHasContent(version)) return "این نسخه محتوای قابل ارسال ندارد.";
  if (version.status === "APPROVED" && version.isLocked) {
    return "این نسخه قبلاً توسط مشتری تأیید شده است.";
  }
  if (
    version.status === "PENDING_CUSTOMER_APPROVAL" &&
    version.publishedToClient
  ) {
    return "این نسخه هم‌اکنون در انتظار تأیید مشتری است.";
  }
  return null;
}
