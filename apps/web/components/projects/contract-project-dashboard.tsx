"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Clapperboard,
  Eye,
  Loader2,
  Pencil,
  PlusCircle,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { apiDelete, apiPatch } from "@/lib/api";
import { invalidateFinanceQueries } from "@/lib/finance-queries";
import { formatCount, type ContractVideoStats } from "@/lib/contract-project";
import { formatCurrency, formatDate, formatPhoneDisplay } from "@/lib/utils";
import {
  isValidWhatsAppNumber,
  toPhoneInputValue,
  WHATSAPP_VALIDATION_MESSAGE,
} from "@/lib/phone";
import { getProjectStatusLabel } from "@/lib/project-status";
import type { ProjectProgress } from "@/lib/project-progress";
import { ProjectProgressBar } from "@/components/projects/project-progress-bar";
import {
  AssignProjectLeadCard,
  type ProjectLeadInfo,
} from "@/components/projects/assign-project-lead-card";
import {
  AssignedPersonCell,
  getAssignedPerson,
  type ProjectAssignmentRecord,
} from "@/components/projects/project-table-cells";
import { HorizontalScroll } from "@/components/shared/horizontal-scroll";
import { WhatsAppPhoneInput } from "@/components/shared/whatsapp-phone-input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type ContractVideo = {
  id: string;
  code: string;
  title: string;
  status: string;
  deadlineAt?: string | null;
  progress?: ProjectProgress | number | null;
  assignments?: ProjectAssignmentRecord[];
  finance?: {
    agreedPrice?: number | string | null;
    finalProjectPrice?: number | string | null;
    received?: number | string | null;
  } | null;
};

function videoPrice(video: ContractVideo): number | null {
  const value = Number(video.finance?.finalProjectPrice ?? video.finance?.agreedPrice);
  return Number.isFinite(value) && value > 0 ? value : null;
}

export type ContractProjectDetail = {
  id: string;
  code: string;
  title: string;
  createdAt?: string;
  brief?: Record<string, unknown> | null;
  videoStats?: ContractVideoStats;
  videos?: ContractVideo[];
  projectLead?: ProjectLeadInfo;
  crmCustomer: {
    id?: string;
    personName: string;
    companyName: string | null;
    jobTitle?: string | null;
    phone?: string | null;
    email?: string | null;
    address?: string | null;
    normalizedWhatsapp?: string | null;
    whatsappRaw?: string | null;
  };
};

function briefText(
  brief: Record<string, unknown> | null | undefined,
  key: string,
  fallback?: string | null,
) {
  const value = brief?.[key];
  if (typeof value === "string" && value.trim()) return value.trim();
  return fallback?.trim() || "";
}

function Stat({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="rounded-2xl border border-border/70 bg-card p-4 shadow-sm">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-bold tabular-nums">{value}</p>
      {hint ? <p className="mt-1 text-[11px] text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="min-w-0">
      <p className="text-[11px] font-medium text-muted-foreground">{label}</p>
      <p className="mt-0.5 break-words text-sm font-medium">{value || "—"}</p>
    </div>
  );
}

function ContractVideosTable({
  videos,
  canDelete,
  onDelete,
}: {
  videos: ContractVideo[];
  canDelete: boolean;
  onDelete: (video: ContractVideo) => void;
}) {
  const router = useRouter();
  const showPrice = videos.some((video) => video.finance != null);
  const openVideo = (id: string) => router.push(`/projects/${id}`);

  return (
    <HorizontalScroll className="rounded-2xl shadow-sm">
      <Table scrollContainer={false} className="min-w-[68rem]">
        <TableHeader>
          <TableRow className="bg-muted/40 hover:bg-muted/40">
            <TableHead className="w-12 text-center">#</TableHead>
            <TableHead className="whitespace-nowrap">کد</TableHead>
            <TableHead className="min-w-[12rem]">عنوان ویدیو</TableHead>
            <TableHead className="whitespace-nowrap">وضعیت</TableHead>
            <TableHead className="min-w-[10rem]">مسئول پروژه</TableHead>
            <TableHead className="min-w-[10rem]">ادیتور</TableHead>
            <TableHead className="min-w-[10rem]">نریتور</TableHead>
            <TableHead className="min-w-[10rem]">پیشرفت پروژه</TableHead>
            {showPrice ? <TableHead className="whitespace-nowrap">قیمت</TableHead> : null}
            <TableHead className="w-24 text-center">عملیات</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {videos.map((video, index) => {
            const price = videoPrice(video);
            return (
              <TableRow
                key={video.id}
                role="link"
                tabIndex={0}
                aria-label={`مشاهده پروژه ویدیو ${video.code}`}
                className="cursor-pointer transition-colors hover:bg-muted/50 focus-visible:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand"
                onClick={() => openVideo(video.id)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    openVideo(video.id);
                  }
                }}
              >
                <TableCell className="text-center text-xs tabular-nums text-muted-foreground">
                  {formatCount(index + 1)}
                </TableCell>
                <TableCell>
                  <span className="whitespace-nowrap font-medium" dir="ltr">
                    {video.code}
                  </span>
                </TableCell>
                <TableCell>
                  <span className="block max-w-[18rem] font-medium leading-snug">
                    {video.title}
                  </span>
                  {video.deadlineAt ? (
                    <span className="mt-1 block text-xs text-muted-foreground">
                      مهلت: {formatDate(video.deadlineAt)}
                    </span>
                  ) : null}
                </TableCell>
                <TableCell>
                  <Badge
                    variant={video.status === "COMPLETED" ? "success" : "secondary"}
                    className="whitespace-nowrap"
                  >
                    {video.status === "COMPLETED" ? (
                      <CheckCircle2 className="me-1 h-3 w-3" />
                    ) : null}
                    {getProjectStatusLabel(video.status)}
                  </Badge>
                </TableCell>
                <TableCell>
                  <AssignedPersonCell
                    person={getAssignedPerson(video.assignments, "PROJECT_LEAD")}
                  />
                </TableCell>
                <TableCell>
                  <AssignedPersonCell
                    person={getAssignedPerson(video.assignments, "EDITOR")}
                  />
                </TableCell>
                <TableCell>
                  <AssignedPersonCell
                    person={getAssignedPerson(video.assignments, "NARRATOR")}
                  />
                </TableCell>
                <TableCell className="min-w-[10rem]">
                  <ProjectProgressBar
                    progress={video.progress}
                    status={video.status}
                    variant="inline"
                    showTitle={false}
                  />
                </TableCell>
                {showPrice ? (
                  <TableCell>
                    {price != null ? (
                      <bdi dir="ltr" className="whitespace-nowrap text-sm font-medium tabular-nums">
                        {formatCurrency(price)}
                      </bdi>
                    ) : (
                      <span className="text-sm text-muted-foreground">—</span>
                    )}
                  </TableCell>
                ) : null}
                <TableCell
                  className="text-center"
                  onClick={(event) => event.stopPropagation()}
                  onKeyDown={(event) => event.stopPropagation()}
                >
                  <div className="flex items-center justify-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-9 w-9 text-muted-foreground hover:text-brand"
                      title="مشاهده پروژه"
                      aria-label="مشاهده پروژه"
                      asChild
                    >
                      <Link href={`/projects/${video.id}`}>
                        <Eye className="h-4 w-4" />
                      </Link>
                    </Button>
                    {canDelete ? (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-9 w-9 text-muted-foreground hover:text-destructive"
                        title="حذف پروژه"
                        aria-label="حذف پروژه"
                        onClick={() => onDelete(video)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    ) : null}
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </HorizontalScroll>
  );
}

export function ContractProjectDashboard({
  project,
  canCreate,
  canEdit,
  canDelete = false,
}: {
  project: ContractProjectDetail;
  canCreate: boolean;
  canEdit: boolean;
  canDelete?: boolean;
}) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [deletingVideo, setDeletingVideo] = useState<ContractVideo | null>(null);
  const deleteVideo = useMutation({
    mutationFn: (id: string) => apiDelete(`/projects/${id}`),
    onSuccess: async () => {
      toast.success("پروژه ویدیو و سوابق پرداخت مرتبط حذف شد");
      setDeletingVideo(null);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["project", project.id] }),
        queryClient.invalidateQueries({ queryKey: ["projects"] }),
        queryClient.invalidateQueries({ queryKey: ["crm-customers"] }),
        queryClient.invalidateQueries({ queryKey: ["crm-customer"] }),
        queryClient.invalidateQueries({ queryKey: ["dashboard-summary"] }),
        invalidateFinanceQueries(queryClient),
      ]);
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "حذف پروژه ناموفق بود");
    },
  });
  const stats = project.videoStats || {
    total: project.videos?.length || 0,
    completed: 0,
    inProgress: 0,
    pending: 0,
    canceled: 0,
    progressPercent: 0,
  };
  const brief = project.brief;
  const customer = project.crmCustomer;
  const personName = briefText(brief, "personName", customer.personName);
  const companyName = briefText(brief, "companyName", customer.companyName);
  const jobTitle = briefText(brief, "jobTitle", customer.jobTitle);
  const phone = briefText(brief, "phone", customer.phone);
  const whatsapp = briefText(
    brief,
    "whatsapp",
    customer.normalizedWhatsapp || customer.whatsappRaw,
  );
  const address = briefText(brief, "address", customer.address);
  const email = briefText(brief, "email", customer.email);
  const website = briefText(brief, "website");

  const [editOpen, setEditOpen] = useState(false);

  return (
    <div className="min-w-0 space-y-5 text-start sm:space-y-6">
      <section className="relative overflow-hidden rounded-2xl border border-border/70 bg-card shadow-sm">
        <div className="relative space-y-4 p-4 sm:p-6">
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" size="sm" className="h-8 gap-1.5" asChild>
              <Link href="/projects">
                <ArrowRight className="h-3.5 w-3.5" />
                پروژه‌ها
              </Link>
            </Button>
            <Badge variant="outline" className="font-mono" dir="ltr">
              {project.code}
            </Badge>
            <Badge variant="brand">ماهانه / چندویدیویی</Badge>
          </div>
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div className="min-w-0 space-y-1">
              <h1 className="break-words text-xl font-bold tracking-tight sm:text-3xl">
                {project.title}
              </h1>
              <p className="text-sm text-muted-foreground">
                {companyName || personName}
                {project.createdAt ? ` · ایجاد: ${formatDate(project.createdAt)}` : ""}
                {customer.id ? (
                  <>
                    {" · "}
                    <Link
                      href={`/crm/${customer.id}`}
                      className="text-brand underline-offset-2 hover:underline"
                    >
                      پرونده مشتری
                    </Link>
                  </>
                ) : null}
              </p>
            </div>
            {canCreate || canEdit ? (
              <div className="flex flex-wrap gap-2 md:shrink-0 md:justify-end">
                {canEdit ? (
                  <Button variant="outline" className="rounded-xl" onClick={() => setEditOpen(true)}>
                    <Pencil className="h-4 w-4" />
                    ویرایش قرارداد
                  </Button>
                ) : null}
                {canCreate ? (
                  <Button
                    variant="brand"
                    className="rounded-xl"
                    onClick={() => router.push(`/projects/new?parent=${project.id}`)}
                  >
                    <PlusCircle className="h-4 w-4" />
                    ایجاد پروژه ویدیو
                  </Button>
                ) : null}
              </div>
            ) : null}
          </div>
          <ProjectProgressBar
            progress={{ percent: stats.progressPercent }}
            variant="full"
          />
          <AssignProjectLeadCard projectId={project.id} projectLead={project.projectLead} />
        </div>
      </section>

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <Stat label="ویدیوها" value={formatCount(stats.total)} hint="بدون سقف ثابت" />
        <Stat label="تکمیل‌شده" value={formatCount(stats.completed)} />
        <Stat label="در جریان" value={formatCount(stats.inProgress)} />
        <Stat label="در انتظار" value={formatCount(stats.pending)} />
      </div>
      {stats.canceled > 0 ? (
        <p className="-mt-2 text-xs text-muted-foreground">
          {formatCount(stats.canceled)} ویدیوی لغوشده در جمع پیشرفت حساب نمی‌شود.
        </p>
      ) : null}

      <section className="space-y-4 rounded-2xl border border-border/70 bg-card p-4 shadow-sm sm:p-5">
        <h2 className="text-base font-semibold">اطلاعات مشتری</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <InfoRow label="نام" value={personName} />
          <InfoRow label="سمت" value={jobTitle} />
          <InfoRow label="شرکت" value={companyName} />
          <InfoRow label="تلفن" value={formatPhoneDisplay(phone)} />
          <InfoRow label="واتساپ" value={formatPhoneDisplay(whatsapp)} />
          <InfoRow label="ایمیل" value={email} />
          <InfoRow label="آدرس" value={address} />
          <InfoRow label="وب‌سایت" value={website} />
        </div>
      </section>

      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Clapperboard className="h-4 w-4 text-muted-foreground" />
            <h2 className="text-base font-semibold">پروژه‌های ویدیو</h2>
            <Badge variant="secondary" className="tabular-nums">
              {formatCount(project.videos?.length || 0)}
            </Badge>
          </div>
          {canCreate && project.videos?.length ? (
            <Button
              variant="outline"
              size="sm"
              className="rounded-xl"
              onClick={() => router.push(`/projects/new?parent=${project.id}`)}
            >
              <PlusCircle className="h-4 w-4" />
              ویدیو جدید
            </Button>
          ) : null}
        </div>
        {project.videos?.length ? (
          <ContractVideosTable
            videos={project.videos}
            canDelete={canDelete}
            onDelete={setDeletingVideo}
          />
        ) : (
          <div className="rounded-2xl border border-dashed bg-muted/20 px-4 py-10 text-center">
            <p className="font-semibold">هنوز ویدیویی ثبت نشده</p>
            <p className="mt-1 text-sm text-muted-foreground">
              هر ویدیو یک پروژه مستقل است و اطلاعات مشتری را از همین قرارداد می‌گیرد.
            </p>
            {canCreate ? (
              <Button
                variant="brand"
                className="mt-4 rounded-xl"
                onClick={() => router.push(`/projects/new?parent=${project.id}`)}
              >
                <PlusCircle className="h-4 w-4" />
                ایجاد پروژه ویدیو
              </Button>
            ) : null}
          </div>
        )}
      </section>

      {canEdit ? (
        <EditContractDialog
          open={editOpen}
          onOpenChange={setEditOpen}
          project={project}
          defaults={{
            personName,
            jobTitle,
            companyName,
            phone: toPhoneInputValue(phone) || phone,
            whatsapp: toPhoneInputValue(whatsapp) || whatsapp,
            address,
            email,
            website,
          }}
          onSaved={async () => {
            await Promise.all([
              queryClient.invalidateQueries({ queryKey: ["project", project.id] }),
              queryClient.invalidateQueries({ queryKey: ["projects"] }),
            ]);
          }}
        />
      ) : null}

      <Dialog
        open={Boolean(deletingVideo)}
        onOpenChange={(open) => {
          if (!open && !deleteVideo.isPending) setDeletingVideo(null);
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
              <AlertTriangle className="h-6 w-6 text-destructive" />
            </div>
            <DialogTitle>حذف پروژه ویدیو</DialogTitle>
            <DialogDescription>
              آیا از حذف «{deletingVideo?.code} — {deletingVideo?.title}» مطمئن هستید؟
              این ویدیو همراه با فاکتورها و پرداخت‌های مرتبط حذف می‌شود و قابل
              بازگشت نیست. قرارداد و سایر ویدیوها تغییری نمی‌کنند.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setDeletingVideo(null)}
              disabled={deleteVideo.isPending}
            >
              انصراف
            </Button>
            <Button
              variant="destructive"
              onClick={() => deletingVideo && deleteVideo.mutate(deletingVideo.id)}
              disabled={deleteVideo.isPending || !deletingVideo}
            >
              {deleteVideo.isPending ? "در حال حذف..." : "بله، حذف شود"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function EditContractDialog({
  open,
  onOpenChange,
  project,
  defaults,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  project: ContractProjectDetail;
  defaults: {
    personName: string;
    jobTitle: string;
    companyName: string;
    phone: string;
    whatsapp: string;
    address: string;
    email: string;
    website: string;
  };
  onSaved: () => Promise<void>;
}) {
  const [form, setForm] = useState(defaults);
  const [prevOpen, setPrevOpen] = useState(open);
  if (open !== prevOpen) {
    setPrevOpen(open);
    if (open) setForm(defaults);
  }

  const save = useMutation({
    mutationFn: () => {
      if (!form.personName.trim() || !form.jobTitle.trim() || !form.companyName.trim() || !form.address.trim()) {
        throw new Error("نام، سمت، شرکت و آدرس الزامی هستند.");
      }
      if (!isValidWhatsAppNumber(form.phone) || !isValidWhatsAppNumber(form.whatsapp)) {
        throw new Error(WHATSAPP_VALIDATION_MESSAGE);
      }
      return apiPatch(`/projects/${project.id}/contract`, {
        personName: form.personName.trim(),
        jobTitle: form.jobTitle.trim(),
        companyName: form.companyName.trim(),
        phone: form.phone.trim(),
        whatsapp: form.whatsapp.trim(),
        address: form.address.trim(),
        email: form.email.trim() || undefined,
        website: form.website.trim() || undefined,
      });
    },
    onSuccess: async () => {
      toast.success("قرارداد به‌روزرسانی شد");
      await onSaved();
      onOpenChange(false);
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "ذخیره ناموفق بود");
    },
  });

  const set = (key: keyof typeof form) => (value: string) =>
    setForm((current) => ({ ...current, [key]: value }));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>ویرایش قرارداد</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="edit-person">نام</Label>
            <Input id="edit-person" value={form.personName} onChange={(e) => set("personName")(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="edit-job">سمت</Label>
            <Input id="edit-job" value={form.jobTitle} onChange={(e) => set("jobTitle")(e.target.value)} />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="edit-company">شرکت</Label>
            <Input id="edit-company" value={form.companyName} onChange={(e) => set("companyName")(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>تلفن</Label>
            <WhatsAppPhoneInput value={form.phone} onChange={set("phone")} />
          </div>
          <div className="space-y-1.5">
            <Label>واتساپ</Label>
            <WhatsAppPhoneInput value={form.whatsapp} onChange={set("whatsapp")} />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="edit-address">آدرس</Label>
            <Input id="edit-address" value={form.address} onChange={(e) => set("address")(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="edit-email">ایمیل</Label>
            <Input id="edit-email" dir="ltr" value={form.email} onChange={(e) => set("email")(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="edit-website">وب‌سایت</Label>
            <Input id="edit-website" dir="ltr" value={form.website} onChange={(e) => set("website")(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={save.isPending}>
            انصراف
          </Button>
          <Button variant="brand" onClick={() => save.mutate()} disabled={save.isPending}>
            {save.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            ذخیره
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
