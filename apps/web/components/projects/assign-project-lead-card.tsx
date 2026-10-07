"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { UserCog, UserMinus, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { ApiError, apiGet, apiPost } from "@/lib/api";
import { useHasPermission, useMeQuery } from "@/lib/permissions";
import { getRoleLabel } from "@/lib/rbac";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export type ProjectLeadInfo = {
  assignmentId?: string;
  userId: string | null;
  teamProfileId?: string | null;
  fullName: string | null;
  profileImage?: string | null;
  assignedAt?: string | null;
  notes?: string | null;
} | null;

type LeadCandidate = {
  userId: string;
  fullName: string;
  email?: string | null;
  displayName: string;
  roleCode?: string | null;
  teamProfileId?: string | null;
};

type AssignProjectLeadCardProps = {
  projectId: string;
  projectLead?: ProjectLeadInfo;
  className?: string;
};

export function AssignProjectLeadCard({
  projectId,
  projectLead,
  className,
}: AssignProjectLeadCardProps) {
  const queryClient = useQueryClient();
  const { data: me } = useMeQuery();
  const role = String(me?.role || "").toUpperCase();
  const canAssign =
    useHasPermission("projects.assign") &&
    (role === "MANAGER" || role === "ADMIN");
  const [open, setOpen] = useState(false);
  const [userId, setUserId] = useState("");
  const [notes, setNotes] = useState("");

  const candidatesQuery = useQuery({
    queryKey: ["project-lead-candidates", projectId],
    queryFn: () =>
      apiGet<{ items: LeadCandidate[] }>(
        `/projects/${projectId}/lead-candidates`,
      ),
    enabled: open && canAssign,
  });

  const candidates = candidatesQuery.data?.items || [];

  const selectedLabel = useMemo(() => {
    const hit = candidates.find((c) => c.userId === userId);
    return hit?.displayName || hit?.fullName || "";
  }, [candidates, userId]);

  function invalidateProject() {
    void queryClient.invalidateQueries({ queryKey: ["project", projectId] });
    void queryClient.invalidateQueries({ queryKey: ["projects"] });
    void queryClient.invalidateQueries({
      queryKey: ["project-lead-candidates", projectId],
    });
  }

  const assignMutation = useMutation({
    mutationFn: () =>
      apiPost(`/projects/${projectId}/assign-lead`, {
        userId,
        notes: notes.trim() || null,
      }),
    onSuccess: () => {
      toast.success("مسئول پروژه با موفقیت تعیین شد");
      setOpen(false);
      setUserId("");
      setNotes("");
      invalidateProject();
    },
    onError: (err) => {
      toast.error(
        err instanceof ApiError ? err.message : "اختصاص مسئول پروژه ناموفق بود",
      );
    },
  });

  const unassignMutation = useMutation({
    mutationFn: () => apiPost(`/projects/${projectId}/unassign-lead`, {}),
    onSuccess: () => {
      toast.success("مسئولیت پروژه برداشته شد");
      invalidateProject();
    },
    onError: (err) => {
      toast.error(
        err instanceof ApiError ? err.message : "حذف مسئول پروژه ناموفق بود",
      );
    },
  });

  if (!canAssign && !projectLead?.fullName) {
    return null;
  }

  return (
    <div
      className={cn(
        "rounded-2xl border border-border/70 bg-card p-3.5 shadow-sm sm:p-4",
        className,
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <div className="flex items-center gap-2">
            <UserCog className="h-4 w-4 shrink-0 text-brand" aria-hidden />
            <p className="text-sm font-semibold">مسئول مدیریت پروژه</p>
          </div>
          <p className="text-[11px] leading-5 text-muted-foreground">
            هر کارمندی را می‌توانید مسئول این پروژه کنید؛ او کنترل کامل همین
            پروژه را خواهد داشت (ارجاع ادیتور/نریتور، تولید محتوا و …)
          </p>
          {projectLead?.fullName ? (
            <div className="pt-1">
              <Badge variant="brand" className="max-w-full truncate">
                {projectLead.fullName}
              </Badge>
              {projectLead.notes ? (
                <p className="mt-1.5 text-[11px] text-muted-foreground">
                  {projectLead.notes}
                </p>
              ) : null}
            </div>
          ) : (
            <p className="pt-1 text-sm text-muted-foreground">هنوز تعیین نشده</p>
          )}
        </div>

        {canAssign ? (
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="gap-1.5"
              onClick={() => {
                setUserId(projectLead?.userId || "");
                setNotes(projectLead?.notes || "");
                setOpen(true);
              }}
            >
              <UserPlus className="h-3.5 w-3.5" />
              {projectLead?.fullName ? "تغییر مسئول" : "اختصاص مسئول"}
            </Button>
            {projectLead?.fullName ? (
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="gap-1.5 text-destructive hover:text-destructive"
                disabled={unassignMutation.isPending}
                onClick={() => unassignMutation.mutate()}
              >
                <UserMinus className="h-3.5 w-3.5" />
                برداشتن
              </Button>
            ) : null}
          </div>
        ) : null}
      </div>

      <Dialog
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (!next) {
            setUserId("");
            setNotes("");
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>اختصاص مسئول مدیریت پروژه</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3 py-1">
            <div className="space-y-1.5">
              <Label>انتخاب کارمند</Label>
              <Select
                dir="rtl"
                value={userId || undefined}
                onValueChange={setUserId}
                disabled={candidatesQuery.isLoading}
              >
                <SelectTrigger>
                  <SelectValue
                    placeholder={
                      candidatesQuery.isLoading
                        ? "در حال بارگذاری…"
                        : "انتخاب کارمند"
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  {candidates.length === 0 ? (
                    <SelectItem value="__none" disabled>
                      کارمند فعالی یافت نشد
                    </SelectItem>
                  ) : (
                    candidates.map((c) => (
                      <SelectItem key={c.userId} value={c.userId}>
                        {c.displayName || c.fullName}
                        {c.roleCode
                          ? ` — ${getRoleLabel(c.roleCode)}`
                          : ""}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
              <p className="text-[11px] text-muted-foreground">
                همه نقش‌های کارمندی قابل انتخاب‌اند. پس از اختصاص، آن کارمند فقط
                روی همین پروژه کنترل کامل مدیریتی دارد.
              </p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="project-lead-notes">یادداشت (اختیاری)</Label>
              <Textarea
                id="project-lead-notes"
                rows={2}
                className="resize-none rounded-xl"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="مثلاً مسئولیت هماهنگی تولید"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              انصراف
            </Button>
            <Button
              disabled={!userId || assignMutation.isPending}
              onClick={() => assignMutation.mutate()}
            >
              {assignMutation.isPending
                ? "در حال ذخیره…"
                : selectedLabel
                  ? `اختصاص به ${selectedLabel}`
                  : "ذخیره"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
