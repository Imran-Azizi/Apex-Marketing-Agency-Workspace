export type ContentVersionLike = {
  id?: string;
  status: string;
  publishedToClient?: boolean;
  publishedAt?: string | null;
  isLocked?: boolean;
  scenario?: unknown;
  narration?: unknown;
  storyboard?: unknown;
  extras?: unknown;
  managerSectionConfirm?: ManagerSectionConfirmState | null;
};

export type ContentSectionKey = "scenario" | "narration" | "storyboard";

export type SectionConfirmEntry = {
  confirmed: boolean;
  at?: string | null;
  byUserId?: string | null;
};

export type ManagerSectionConfirmState = {
  scenario: SectionConfirmEntry;
  narration: SectionConfirmEntry;
  storyboard: SectionConfirmEntry;
  releasedAt?: string | null;
  releasedById?: string | null;
};

export const CONTENT_SECTIONS: ContentSectionKey[] = [
  "scenario",
  "narration",
  "storyboard",
];

export const CONTENT_SECTION_LABELS: Record<ContentSectionKey, string> = {
  scenario: "سناریو",
  narration: "نریشن",
  storyboard: "استوری‌بورد",
};

export function versionHasContent(version: ContentVersionLike | null | undefined) {
  if (!version) return false;
  return (
    version.scenario != null ||
    version.narration != null ||
    version.storyboard != null
  );
}

export function versionHasSection(
  version: ContentVersionLike | null | undefined,
  section: ContentSectionKey,
) {
  if (!version) return false;
  return version[section] != null;
}

export function presentSections(
  version: ContentVersionLike | null | undefined,
): ContentSectionKey[] {
  if (!version) return [];
  return CONTENT_SECTIONS.filter((section) => versionHasSection(version, section));
}

function asObject(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

export function getManagerSectionConfirm(
  version: ContentVersionLike | null | undefined,
): ManagerSectionConfirmState {
  if (version?.managerSectionConfirm) {
    const c = version.managerSectionConfirm;
    return {
      scenario: {
        confirmed: Boolean(c.scenario?.confirmed),
        at: c.scenario?.at ?? null,
        byUserId: c.scenario?.byUserId ?? null,
      },
      narration: {
        confirmed: Boolean(c.narration?.confirmed),
        at: c.narration?.at ?? null,
        byUserId: c.narration?.byUserId ?? null,
      },
      storyboard: {
        confirmed: Boolean(c.storyboard?.confirmed),
        at: c.storyboard?.at ?? null,
        byUserId: c.storyboard?.byUserId ?? null,
      },
      releasedAt: c.releasedAt ?? null,
      releasedById: c.releasedById ?? null,
    };
  }

  const extras = asObject(version?.extras);
  const raw = asObject(extras.managerSectionConfirm);
  const read = (section: ContentSectionKey): SectionConfirmEntry => {
    const entry = asObject(raw[section]);
    return {
      confirmed: Boolean(entry.confirmed),
      at: typeof entry.at === "string" ? entry.at : null,
      byUserId: typeof entry.byUserId === "string" ? entry.byUserId : null,
    };
  };

  return {
    scenario: read("scenario"),
    narration: read("narration"),
    storyboard: read("storyboard"),
    releasedAt: typeof raw.releasedAt === "string" ? raw.releasedAt : null,
    releasedById:
      typeof raw.releasedById === "string" ? raw.releasedById : null,
  };
}

export function sectionConfirmProgress(
  version: ContentVersionLike | null | undefined,
) {
  const present = presentSections(version);
  const confirm = getManagerSectionConfirm(version);
  const confirmedCount = present.filter(
    (section) => confirm[section]?.confirmed === true,
  ).length;
  return {
    present,
    confirmedCount,
    total: present.length,
    allConfirmed:
      present.length > 0 && confirmedCount === present.length,
  };
}

/** Manager can send this version to the customer for approval. */
export function canSendVersionToCustomer(
  version: ContentVersionLike | null | undefined,
) {
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

export function canToggleSectionConfirm(
  version: ContentVersionLike | null | undefined,
) {
  if (!version || !versionHasContent(version)) return false;
  if (version.status === "APPROVED" && version.isLocked) return false;
  return true;
}

export function canReleaseVersionForProduction(
  version: ContentVersionLike | null | undefined,
) {
  if (!canToggleSectionConfirm(version)) return false;
  return sectionConfirmProgress(version).allConfirmed;
}

export function isManagerReleasedVersion(
  version: ContentVersionLike | null | undefined,
) {
  if (!version) return false;
  const confirm = getManagerSectionConfirm(version);
  if (confirm.releasedAt) return true;
  return version.status === "APPROVED" && Boolean(version.isLocked);
}

export function versionSendBlockReason(
  version: ContentVersionLike | null | undefined,
): string | null {
  if (!version) return "نسخه‌ای انتخاب نشده است.";
  if (!versionHasContent(version)) return "این نسخه محتوای قابل ارسال ندارد.";
  if (version.status === "APPROVED" && version.isLocked) {
    return "این نسخه قبلاً تأیید شده است و نیازی به ارسال برای مشتری ندارد.";
  }
  if (
    version.status === "PENDING_CUSTOMER_APPROVAL" &&
    version.publishedToClient
  ) {
    return "این نسخه هم‌اکنون در انتظار تأیید مشتری است.";
  }
  return null;
}
