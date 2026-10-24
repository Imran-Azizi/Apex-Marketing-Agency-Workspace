"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Archive,
  ArrowRight,
  Download,
  FileText,
  ImageIcon,
  Pencil,
  Send,
  Trash2,
  Video,
} from "lucide-react";
import { toast } from "sonner";
import {
  apiDelete,
  apiGet,
  apiPost,
  ApiError,
  resolveAssetSrc,
} from "@/lib/api";
import { formatDateTime, cn } from "@/lib/utils";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { UserAvatar } from "@/components/shared/user-avatar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { KnowledgeFormDialog } from "./knowledge-form-dialog";
import {
  STATUS_BADGE_VARIANTS,
  STATUS_LABELS,
  type KnowledgeAttachment,
  type KnowledgeEntry,
  type KnowledgeKind,
  type KnowledgeStatus,
} from "./types";

function attachmentIcon(kind: KnowledgeAttachment["kind"]) {
  if (kind === "IMAGE") return ImageIcon;
  if (kind === "VIDEO") return Video;
  return FileText;
}

export type KnowledgeDetailViewProps = {
  id: string;
  /** Expected kind for this route; mismatch redirects to the other section. */
  expectedKind: KnowledgeKind;
  listHref: string;
  listLabel: string;
};

export function KnowledgeDetailView({
  id,
  expectedKind,
  listHref,
  listLabel,
}: KnowledgeDetailViewProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [editOpen, setEditOpen] = useState(false);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["knowledge", "detail", id],
    queryFn: () => apiGet<KnowledgeEntry>(`/knowledge/${id}`),
  });

  useEffect(() => {
    if (!data?.kind) return;
    if (data.kind === expectedKind) return;
    if (data.kind === "POLICY") {
      router.replace(`/policies/${id}`);
    } else {
      router.replace(`/knowledge/${id}`);
    }
  }, [data?.kind, expectedKind, id, router]);

  const invalidate = async () => {
    await queryClient.invalidateQueries({ queryKey: ["knowledge"] });
    await refetch();
  };

  const publishMutation = useMutation({
    mutationFn: () => apiPost<KnowledgeEntry>(`/knowledge/${id}/publish`, {}),
    onSuccess: async () => {
      toast.success(
        expectedKind === "POLICY"
          ? "منتشر شد — کارمندان نقش مخاطب می‌توانند ببینند"
          : "منتشر شد — همکاران هم‌نقش می‌توانند ببینند",
      );
      await invalidate();
    },
    onError: (err) =>
      toast.error(err instanceof ApiError ? err.message : "خطا در انتشار"),
  });

  const archiveMutation = useMutation({
    mutationFn: () => apiPost<KnowledgeEntry>(`/knowledge/${id}/archive`, {}),
    onSuccess: async () => {
      toast.success("آرشیف شد");
      await invalidate();
    },
    onError: (err) =>
      toast.error(err instanceof ApiError ? err.message : "خطا در آرشیف"),
  });

  const deleteMutation = useMutation({
    mutationFn: () => apiDelete(`/knowledge/${id}`),
    onSuccess: async () => {
      toast.success("حذف شد");
      await queryClient.invalidateQueries({ queryKey: ["knowledge"] });
      router.push(listHref);
    },
    onError: (err) =>
      toast.error(err instanceof ApiError ? err.message : "خطا در حذف"),
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="h-10 w-64 animate-pulse rounded-lg bg-muted" />
        <div className="h-64 animate-pulse rounded-2xl bg-muted/50" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <EmptyState
        title="مورد یافت نشد"
        description={
          expectedKind === "POLICY"
            ? "این پالیسی وجود ندارد یا متعلق به نقش دیگری است."
            : "این تجربه وجود ندارد یا متعلق به نقش دیگری است."
        }
        action={
          <Button asChild variant="outline">
            <Link href={listHref}>بازگشت به {listLabel}</Link>
          </Button>
        }
      />
    );
  }

  if (data.kind && data.kind !== expectedKind) {
    return (
      <div className="space-y-4">
        <div className="h-10 w-64 animate-pulse rounded-lg bg-muted" />
        <div className="h-64 animate-pulse rounded-2xl bg-muted/50" />
      </div>
    );
  }

  const caps = data.capabilities;
  const steps = data.steps || [];
  const attachments = data.attachments || [];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Link href={listHref} className="hover:text-foreground">
          {listLabel}
        </Link>
        <ArrowRight className="h-3.5 w-3.5 rotate-180" />
        <span className="text-foreground">{data.roleAudienceLabel}</span>
      </div>

      <PageHeader
        title={data.title}
        subtitle={data.summary || undefined}
        actions={
          <div className="flex flex-wrap gap-2">
            {caps?.canEdit && (
              <Button variant="outline" onClick={() => setEditOpen(true)}>
                <Pencil className="ml-1.5 h-4 w-4" />
                ویرایش
              </Button>
            )}
            {caps?.canPublish && (
              <Button
                variant="outline"
                onClick={() => publishMutation.mutate()}
                disabled={publishMutation.isPending}
              >
                <Send className="ml-1.5 h-4 w-4" />
                انتشار
              </Button>
            )}
            {caps?.canArchive && (
              <Button
                variant="outline"
                onClick={() => archiveMutation.mutate()}
                disabled={archiveMutation.isPending}
              >
                <Archive className="ml-1.5 h-4 w-4" />
                آرشیف
              </Button>
            )}
            {caps?.canDelete && (
              <Button
                variant="destructive"
                onClick={() => {
                  if (confirm("آیا از حذف مطمئن هستید؟")) {
                    deleteMutation.mutate();
                  }
                }}
                disabled={deleteMutation.isPending}
              >
                <Trash2 className="ml-1.5 h-4 w-4" />
                حذف
              </Button>
            )}
          </div>
        }
      />

      <div className="flex flex-wrap gap-2">
        <Badge variant={STATUS_BADGE_VARIANTS[data.status]}>
          {STATUS_LABELS[data.status as KnowledgeStatus] || data.statusLabel}
        </Badge>
        {data.kindLabel && <Badge variant="outline">{data.kindLabel}</Badge>}
        {data.kind !== "POLICY" && data.category && (
          <Badge variant="outline">{data.category}</Badge>
        )}
        <Badge variant="secondary">{data.roleAudienceLabel}</Badge>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_260px]">
        <div className="space-y-6">
          {data.body && (
            <section className="rounded-2xl border bg-card p-5 shadow-sm">
              <h2 className="mb-3 text-sm font-semibold text-muted-foreground">
                محتوا
              </h2>
              <div className="whitespace-pre-wrap text-sm leading-7">
                {data.body}
              </div>
            </section>
          )}

          {steps.length > 0 && (
            <section className="rounded-2xl border bg-card p-5 shadow-sm">
              <h2 className="mb-4 text-sm font-semibold text-muted-foreground">
                گام‌به‌گام
              </h2>
              <ol className="space-y-4">
                {steps.map((step, index) => (
                  <li key={step.id || index} className="flex gap-3">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
                      {index + 1}
                    </span>
                    <div className="min-w-0 flex-1 rounded-xl bg-muted/40 p-3">
                      <h3 className="font-medium">{step.title}</h3>
                      {step.body && (
                        <p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-muted-foreground">
                          {step.body}
                        </p>
                      )}
                    </div>
                  </li>
                ))}
              </ol>
            </section>
          )}

          {attachments.length > 0 && (
            <section className="rounded-2xl border bg-card p-5 shadow-sm">
              <h2 className="mb-4 text-sm font-semibold text-muted-foreground">
                پیوست‌ها
              </h2>
              <div className="grid gap-3 sm:grid-cols-2">
                {attachments.map((att) => {
                  const Icon = attachmentIcon(att.kind);
                  const src = resolveAssetSrc({
                    url: att.url,
                    storageKey: att.storageKey,
                  });
                  return (
                    <div
                      key={att.id}
                      className="overflow-hidden rounded-xl border bg-muted/20"
                    >
                      {att.kind === "IMAGE" && src ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={src}
                          alt={att.fileName}
                          className="aspect-video w-full object-cover"
                        />
                      ) : null}
                      {att.kind === "VIDEO" && src ? (
                        <video
                          src={src}
                          controls
                          className="aspect-video w-full bg-black"
                        />
                      ) : null}
                      <div className="flex items-center justify-between gap-2 p-3">
                        <div className="flex min-w-0 items-center gap-2">
                          <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
                          <span className="truncate text-sm">{att.fileName}</span>
                        </div>
                        {src && (
                          <a
                            href={src}
                            target="_blank"
                            rel="noreferrer"
                            className={cn(
                              "inline-flex h-8 w-8 items-center justify-center rounded-md hover:bg-muted",
                            )}
                          >
                            <Download className="h-4 w-4" />
                          </a>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          )}
        </div>

        <aside className="space-y-4">
          <div className="rounded-2xl border bg-card p-4 shadow-sm">
            <h3 className="mb-3 text-xs font-semibold text-muted-foreground">
              نویسنده
            </h3>
            <div className="flex items-center gap-3">
              <UserAvatar
                name={data.author?.fullName}
                profileImage={data.author?.profileImage}
              />
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">
                  {data.author?.fullName}
                </p>
                <p className="text-xs text-muted-foreground">
                  {data.author?.roleName || data.roleAudienceLabel}
                </p>
              </div>
            </div>
          </div>
          <div className="rounded-2xl border bg-card p-4 text-sm shadow-sm">
            <dl className="space-y-3">
              <div className="flex justify-between gap-3">
                <dt className="text-muted-foreground">انتشار</dt>
                <dd>{formatDateTime(data.publishedAt || data.createdAt)}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-muted-foreground">به‌روزرسانی</dt>
                <dd>{formatDateTime(data.updatedAt)}</dd>
              </div>
            </dl>
          </div>
        </aside>
      </div>

      <KnowledgeFormDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        entry={data}
        defaultKind={data.kind || expectedKind}
      />
    </div>
  );
}
