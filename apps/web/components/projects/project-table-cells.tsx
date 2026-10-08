import { Clapperboard } from "lucide-react";
import { UserAvatar } from "@/components/shared/user-avatar";
import { formatCount, type ContractVideoStats } from "@/lib/contract-project";
import { cn } from "@/lib/utils";

export type ProjectAssignmentRecord = {
  role: string;
  teamProfile?: { displayName?: string | null; userId?: string | null } | null;
  user?: {
    id?: string;
    fullName?: string | null;
    profileImage?: string | null;
  } | null;
};

export type AssignedPerson = { name: string; profileImage: string | null };

export function getAssignedPerson(
  assignments: ProjectAssignmentRecord[] | null | undefined,
  role: "EDITOR" | "NARRATOR" | "PROJECT_LEAD",
): AssignedPerson | null {
  const assignment = assignments?.find((item) => item.role === role);
  if (!assignment) return null;
  const name =
    assignment.teamProfile?.displayName || assignment.user?.fullName || null;
  if (!name) return null;
  return { name, profileImage: assignment.user?.profileImage || null };
}

export function AssignedPersonCell({
  person,
  className,
}: {
  person: AssignedPerson | null;
  className?: string;
}) {
  if (!person) {
    return (
      <span
        className={cn(
          "inline-flex min-w-[10rem] items-center text-sm text-muted-foreground",
          className,
        )}
      >
        تعیین نشده
      </span>
    );
  }
  return (
    <div
      className={cn(
        "flex min-w-[10rem] items-center gap-3 overflow-hidden text-sm",
        className,
      )}
      title={person.name}
    >
      <UserAvatar name={person.name} profileImage={person.profileImage} className="h-8 w-8" />
      <span className="truncate text-sm font-medium">{person.name}</span>
    </div>
  );
}

const STAT_SEGMENTS = [
  { key: "completed", label: "تکمیل", dot: "bg-emerald-500" },
  { key: "inProgress", label: "در جریان", dot: "bg-sky-500" },
  { key: "pending", label: "در انتظار", dot: "bg-amber-500" },
] as const;

/** Video counts for a monthly / multi-video contract, shown as one compact segmented strip. */
export function ContractVideoStatsSummary({
  stats,
  className,
}: {
  stats?: ContractVideoStats | null;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "inline-flex items-stretch overflow-hidden whitespace-nowrap rounded-lg border border-border/70 bg-muted/30 text-[11px] leading-none [&>*+*]:border-s [&>*+*]:border-border/70",
        className,
      )}
    >
      <span className="inline-flex items-center gap-1.5 bg-brand/10 px-2.5 py-1.5 font-semibold text-brand">
        <Clapperboard className="h-3.5 w-3.5" />
        <span className="tabular-nums">{formatCount(stats?.total ?? 0)}</span>
        ویدیو
      </span>
      {STAT_SEGMENTS.map(({ key, label, dot }) => (
        <span key={key} className="inline-flex items-center gap-1.5 px-2.5 py-1.5">
          <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", dot)} aria-hidden />
          <span className="text-muted-foreground">{label}</span>
          <span className="font-semibold tabular-nums text-foreground">
            {formatCount(stats?.[key] ?? 0)}
          </span>
        </span>
      ))}
    </div>
  );
}
