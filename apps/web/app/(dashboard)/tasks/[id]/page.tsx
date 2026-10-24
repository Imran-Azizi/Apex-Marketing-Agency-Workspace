"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  CirclePlay,
  Flag,
  Pencil,
  ThumbsDown,
  ThumbsUp,
  XCircle,
} from "lucide-react";
import { apiGet } from "@/lib/api";
import { formatDateTime, cn } from "@/lib/utils";
import { useHasPermission, useMeQuery } from "@/lib/permissions";
import { PageHeader } from "@/components/shared/page-header";
import { UserAvatar } from "@/components/shared/user-avatar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { TaskFormDialog } from "../_components/task-form-dialog";
import {
  TaskNoteActionDialog,
  useSimpleTaskAction,
} from "../_components/task-action-dialogs";
import {
  ACTIVITY_LABELS,
  PRIORITY_BADGE_VARIANTS,
  PRIORITY_LABELS,
  STATUS_BADGE_VARIANTS,
  STATUS_LABELS,
  type ManagementTask,
  type TaskPriority,
  type TaskStatus,
} from "../_components/types";

type NoteAction =
  | "decline"
  | "complete"
  | "report-issue"
  | "approve"
  | "reject-completion"
  | "cancel"
  | "delete";

export default function TaskDetailPage() {
  const params = useParams<{ id: string }>();
  const taskId = params?.id;
  const { data: me } = useMeQuery();
  const canCreate = useHasPermission("tasks.create");
  const canEdit = useHasPermission("tasks.edit");
  const canManage = useHasPermission("tasks.manage");
  const canDelete = useHasPermission("tasks.delete");

  const [formOpen, setFormOpen] = useState(false);
  const [noteAction, setNoteAction] = useState<NoteAction | null>(null);
  const [noteOpen, setNoteOpen] = useState(false);

  const { data: task, isLoading, error } = useQuery({
    queryKey: ["tasks", "detail", taskId],
    queryFn: () => apiGet<ManagementTask>(`/tasks/${taskId}`),
    enabled: Boolean(taskId),
  });

  const simpleAction = useSimpleTaskAction();

  const isAssignee = Boolean(me?.id && task?.assigneeId === me.id);
  const isManagerView = canManage || canEdit || canCreate;

  function openNote(action: NoteAction) {
    setNoteAction(action);
    setNoteOpen(true);
  }

  if (isLoading) {
    return (
      <div className="space-y-6" dir="rtl">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-10 w-72 max-w-full" />
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
          <Skeleton className="h-52 w-full rounded-2xl" />
          <Skeleton className="h-64 w-full rounded-2xl" />
        </div>
      </div>
    );
  }

  if (error || !task) {
    return (
      <div className="space-y-4 text-start" dir="rtl">
        <p className="text-sm text-destructive">
          وظیفه یافت نشد یا دسترسی ندارید.
        </p>
        <Button variant="outline" asChild>
          <Link href="/tasks" className="inline-flex items-center gap-2">
            <ArrowRight className="h-4 w-4" />
            بازگشت به فهرست
          </Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-5 text-start" dir="rtl">
      <nav aria-label="بازگشت">
        <Button
          variant="ghost"
          size="sm"
          className="-ms-2 h-8 gap-1.5 px-2 text-muted-foreground hover:text-foreground"
          asChild
        >
          <Link href="/tasks">
            <ArrowRight className="h-3.5 w-3.5" />
            فهرست وظایف
          </Link>
        </Button>
      </nav>

      <PageHeader
        title={task.title}
        subtitle="جزئیات، اقدامات و تاریخچه فعالیت"
        actions={
          (canEdit || canCreate) &&
          !["APPROVED", "CANCELLED"].includes(task.status) ? (
            <Button variant="outline" onClick={() => setFormOpen(true)}>
              <Pencil className="h-4 w-4" />
              ویرایش
            </Button>
          ) : null
        }
      />

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        {/* Main column — first in DOM = right side under RTL */}
        <div className="space-y-4 rounded-2xl border border-border/70 bg-card p-5 text-start">
          <div className="flex flex-wrap items-center justify-start gap-2">
            <Badge variant={STATUS_BADGE_VARIANTS[task.status as TaskStatus]}>
              {STATUS_LABELS[task.status as TaskStatus]}
            </Badge>
            <Badge
              variant={PRIORITY_BADGE_VARIANTS[task.priority as TaskPriority]}
            >
              {PRIORITY_LABELS[task.priority as TaskPriority]}
            </Badge>
            {task.isOverdue ? (
              <Badge variant="destructive" className="gap-1">
                <AlertTriangle className="h-3 w-3" />
                گذشته از مهلت
              </Badge>
            ) : null}
          </div>

          <div className="space-y-2">
            <h2 className="text-sm font-medium text-muted-foreground">
              توضیحات
            </h2>
            <p className="whitespace-pre-wrap text-sm leading-7 text-foreground">
              {task.description || "—"}
            </p>
          </div>

          {(task.issueNote ||
            task.rejectionNote ||
            task.declineNote ||
            task.completionNote) && (
            <div className="space-y-2 rounded-xl border border-border/60 bg-muted/30 p-3 text-start text-sm">
              {task.issueNote ? (
                <p>
                  <span className="font-medium">گزارش مشکل: </span>
                  {task.issueNote}
                </p>
              ) : null}
              {task.rejectionNote ? (
                <p>
                  <span className="font-medium">دلیل رد تکمیل: </span>
                  {task.rejectionNote}
                </p>
              ) : null}
              {task.declineNote ? (
                <p>
                  <span className="font-medium">دلیل رد پذیرش: </span>
                  {task.declineNote}
                </p>
              ) : null}
              {task.completionNote ? (
                <p>
                  <span className="font-medium">یادداشت تکمیل: </span>
                  {task.completionNote}
                </p>
              ) : null}
            </div>
          )}

          <div className="flex flex-wrap items-center justify-start gap-2 border-t border-border/60 pt-4">
            {isAssignee && task.status === "PENDING" ? (
              <>
                <Button
                  variant="brand"
                  isLoading={simpleAction.isPending}
                  onClick={() =>
                    simpleAction.mutate({ taskId: task.id, action: "accept" })
                  }
                >
                  <ThumbsUp className="h-4 w-4" />
                  پذیرش وظیفه
                </Button>
                <Button variant="outline" onClick={() => openNote("decline")}>
                  <ThumbsDown className="h-4 w-4" />
                  رد وظیفه
                </Button>
              </>
            ) : null}

            {isAssignee &&
            (task.status === "ACCEPTED" || task.status === "ISSUE_REPORTED") ? (
              <Button
                variant="brand"
                isLoading={simpleAction.isPending}
                onClick={() =>
                  simpleAction.mutate({ taskId: task.id, action: "start" })
                }
              >
                <CirclePlay className="h-4 w-4" />
                شروع / در حال انجام
              </Button>
            ) : null}

            {isAssignee &&
            ["ACCEPTED", "IN_PROGRESS", "ISSUE_REPORTED"].includes(
              task.status,
            ) ? (
              <Button variant="brand" onClick={() => openNote("complete")}>
                <CheckCircle2 className="h-4 w-4" />
                ارسال برای تأیید
              </Button>
            ) : null}

            {isAssignee &&
            ["PENDING", "ACCEPTED", "IN_PROGRESS"].includes(task.status) ? (
              <Button variant="outline" onClick={() => openNote("report-issue")}>
                <Flag className="h-4 w-4" />
                گزارش مشکل
              </Button>
            ) : null}

            {canManage && task.status === "COMPLETED" ? (
              <>
                <Button variant="brand" onClick={() => openNote("approve")}>
                  <CheckCircle2 className="h-4 w-4" />
                  تأیید و تکمیل نهایی
                </Button>
                <Button
                  variant="destructive"
                  onClick={() => openNote("reject-completion")}
                >
                  <XCircle className="h-4 w-4" />
                  رد و بازگشت
                </Button>
              </>
            ) : null}

            {isManagerView &&
            !["APPROVED", "CANCELLED"].includes(task.status) ? (
              <Button variant="outline" onClick={() => openNote("cancel")}>
                لغو وظیفه
              </Button>
            ) : null}

            {canDelete ? (
              <Button
                variant="ghost"
                className="text-destructive"
                onClick={() => openNote("delete")}
              >
                حذف
              </Button>
            ) : null}
          </div>
        </div>

        {/* Side column — second in DOM = left side under RTL */}
        <div className="space-y-4">
          <div className="space-y-4 rounded-2xl border border-border/70 bg-card p-5 text-start">
            <h2 className="text-sm font-semibold">اطلاعات</h2>
            <InfoRow label="مسئول">
              <div className="flex items-center justify-start gap-2">
                <UserAvatar
                  name={task.assignee?.fullName}
                  profileImage={task.assignee?.profileImage}
                  className="h-8 w-8"
                />
                <span>{task.assignee?.fullName || "—"}</span>
              </div>
            </InfoRow>
            <InfoRow label="ایجادکننده">
              {task.createdBy?.fullName || "—"}
            </InfoRow>
            <InfoRow label="مهلت">
              <span
                className={cn(
                  "inline-block tabular-nums",
                  task.isOverdue && "font-medium text-destructive",
                )}
              >
                {formatDateTime(task.deadline)}
              </span>
            </InfoRow>
            <InfoRow label="تاریخ ایجاد">
              <span className="inline-block tabular-nums">
                {formatDateTime(task.createdAt)}
              </span>
            </InfoRow>
            {task.approvedAt ? (
              <InfoRow label="تأیید">
                <span>
                  {task.approvedBy?.fullName || "—"}
                  <span className="mx-1 text-muted-foreground">·</span>
                  <span className="inline-block tabular-nums">
                    {formatDateTime(task.approvedAt)}
                  </span>
                </span>
              </InfoRow>
            ) : null}
          </div>

          <div className="rounded-2xl border border-border/70 bg-card p-5 text-start">
            <h2 className="mb-4 text-sm font-semibold">تاریخچه فعالیت</h2>
            {!task.activities?.length ? (
              <p className="text-sm text-muted-foreground">
                هنوز فعالیتی ثبت نشده.
              </p>
            ) : (
              <ol className="space-y-4">
                {task.activities.map((item) => (
                  <li
                    key={item.id}
                    className="relative border-s border-border/70 ps-4 text-start"
                  >
                    <span className="absolute -start-[5px] top-1.5 h-2.5 w-2.5 rounded-full bg-brand" />
                    <p className="text-sm font-medium">
                      {ACTIVITY_LABELS[item.action] || item.action}
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {item.actor?.fullName || "سیستم"}
                      <span className="mx-1">·</span>
                      <span className="inline-block tabular-nums">
                        {formatDateTime(item.createdAt)}
                      </span>
                    </p>
                    {item.message ? (
                      <p className="mt-1 text-xs leading-6 text-foreground/90">
                        {item.message}
                      </p>
                    ) : null}
                    {item.fromStatus || item.toStatus ? (
                      <p className="mt-1 text-[11px] text-muted-foreground">
                        از{" "}
                        {item.fromStatus
                          ? STATUS_LABELS[item.fromStatus as TaskStatus]
                          : "—"}{" "}
                        به{" "}
                        {item.toStatus
                          ? STATUS_LABELS[item.toStatus as TaskStatus]
                          : "—"}
                      </p>
                    ) : null}
                  </li>
                ))}
              </ol>
            )}
          </div>
        </div>
      </div>

      <TaskFormDialog open={formOpen} onOpenChange={setFormOpen} task={task} />
      <TaskNoteActionDialog
        open={noteOpen}
        onOpenChange={(open) => {
          setNoteOpen(open);
          if (!open) setNoteAction(null);
        }}
        task={task}
        action={noteAction}
      />
    </div>
  );
}

/** Label at inline-start (right in RTL), value immediately beside it — no far-edge stretch. */
function InfoRow({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="flex items-start gap-3 text-sm">
      <span className="w-[5.5rem] shrink-0 pt-0.5 text-muted-foreground sm:w-28">
        {label}
      </span>
      <div className="min-w-0 flex-1 text-start text-foreground">{children}</div>
    </div>
  );
}
