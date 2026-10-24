"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Archive,
  ArrowRight,
  Download,
  Pencil,
  Send,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import {
  apiDelete,
  apiGet,
  apiPost,
  ApiError,
  resolveAssetSrc,
} from "@/lib/api";
import { downloadStoredFile } from "@/lib/upload";
import { formatDateTime, cn } from "@/lib/utils";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { KnowledgeFormDialog } from "../../knowledge/_components/knowledge-form-dialog";
import type {
  KnowledgeAttachment,
  KnowledgeEntry,
} from "../../knowledge/_components/types";
import { PolicyPdfEmbed } from "./policy-pdf-embed";

function isPdf(att: KnowledgeAttachment) {
  return (
    att.mimeType === "application/pdf" ||
    att.fileName.toLowerCase().endsWith(".pdf")
  );
}

function isImage(att: KnowledgeAttachment) {
  return att.kind === "IMAGE" || att.mimeType.startsWith("image/");
}

function isVideo(att: KnowledgeAttachment) {
  return att.kind === "VIDEO" || att.mimeType.startsWith("video/");
}

export function PolicyReaderView({ id }: { id: string }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [editOpen, setEditOpen] = useState(false);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["knowledge", "detail", id],
    queryFn: () => apiGet<KnowledgeEntry>(`/knowledge/${id}`),
  });

  useEffect(() => {
    if (!data?.kind) return;
    if (data.kind === "POLICY") return;
    router.replace(`/knowledge/${id}`);
  }, [data?.kind, id, router]);

  const invalidate = async () => {
    await queryClient.invalidateQueries({ queryKey: ["knowledge"] });
    await refetch();
  };

  const publishMutation = useMutation({
    mutationFn: () => apiPost<KnowledgeEntry>(`/knowledge/${id}/publish`, {}),
    onSuccess: async () => {
      toast.success("منتشر شد — کارمندان نقش مخاطب می‌توانند ببینند");
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
      router.push("/policies");
    },
    onError: (err) =>
      toast.error(err instanceof ApiError ? err.message : "خطا در حذف"),
  });

  if (isLoading || (data?.kind && data.kind !== "POLICY")) {
    return (
      <div className="mx-auto max-w-4xl space-y-4 py-8">
        <div className="h-8 w-40 animate-pulse rounded bg-muted" />
        <div className="h-[70vh] animate-pulse rounded-sm bg-muted/40" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <EmptyState
        title="پالیسی یافت نشد"
        description="این پالیسی وجود ندارد یا متعلق به نقش دیگری است."
        action={
          <Button asChild variant="outline">
            <Link href="/policies">بازگشت به پالیسی‌های شرکت</Link>
          </Button>
        }
      />
    );
  }

  const caps = data.capabilities;
  const attachments = data.attachments || [];
  const readableDocs = attachments.filter(
    (att) => isPdf(att) || isImage(att) || isVideo(att),
  );
  const otherFiles = attachments.filter(
    (att) => !isPdf(att) && !isImage(att) && !isVideo(att),
  );
  const hasManageActions =
    caps?.canEdit || caps?.canPublish || caps?.canArchive || caps?.canDelete;

  return (
    <div className="pb-16">
      <div className="mb-8 flex flex-wrap items-center justify-between gap-3">
        <Link
          href="/policies"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground transition hover:text-foreground"
        >
          <ArrowRight className="h-3.5 w-3.5 rotate-180" />
          بازگشت به پالیسی‌های شرکت
        </Link>

        {hasManageActions && (
          <div className="flex flex-wrap gap-2">
            {caps?.canEdit && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setEditOpen(true)}
              >
                <Pencil className="ml-1.5 h-3.5 w-3.5" />
                ویرایش
              </Button>
            )}
            {caps?.canPublish && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => publishMutation.mutate()}
                disabled={publishMutation.isPending}
              >
                <Send className="ml-1.5 h-3.5 w-3.5" />
                انتشار
              </Button>
            )}
            {caps?.canArchive && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => archiveMutation.mutate()}
                disabled={archiveMutation.isPending}
              >
                <Archive className="ml-1.5 h-3.5 w-3.5" />
                آرشیف
              </Button>
            )}
            {caps?.canDelete && (
              <Button
                variant="destructive"
                size="sm"
                onClick={() => {
                  if (confirm("آیا از حذف مطمئن هستید؟")) {
                    deleteMutation.mutate();
                  }
                }}
                disabled={deleteMutation.isPending}
              >
                <Trash2 className="ml-1.5 h-3.5 w-3.5" />
                حذف
              </Button>
            )}
          </div>
        )}
      </div>

      <article
        className={cn(
          "mx-auto max-w-4xl rounded-sm border border-border/50",
          "bg-gradient-to-b from-card via-card to-muted/20",
          "px-6 py-10 shadow-[0_24px_60px_-28px_rgba(0,0,0,0.55)] sm:px-10 sm:py-12",
        )}
      >
        <header className="mb-10 border-b border-border/40 pb-8 text-center">
          <p className="mb-3 text-[11px] font-medium tracking-[0.2em] text-muted-foreground">
            پالیسی شرکت · {data.roleAudienceLabel}
          </p>
          <h1 className="text-balance text-2xl font-semibold leading-relaxed tracking-tight sm:text-3xl">
            {data.title}
          </h1>
          {data.summary && (
            <p className="mx-auto mt-4 max-w-2xl text-pretty text-base leading-8 text-muted-foreground">
              {data.summary}
            </p>
          )}
          <p className="mt-5 text-xs text-muted-foreground/80">
            {data.author?.fullName ? `${data.author.fullName} · ` : ""}
            {formatDateTime(data.publishedAt || data.createdAt)}
          </p>
        </header>

        {data.body ? (
          <div className="whitespace-pre-wrap text-base leading-[2] text-foreground/95 sm:text-[1.05rem] sm:leading-[2.05]">
            {data.body}
          </div>
        ) : readableDocs.length === 0 ? (
          <p className="py-12 text-center text-sm text-muted-foreground">
            متنی برای این پالیسی ثبت نشده است.
          </p>
        ) : null}

        {readableDocs.length > 0 && (
          <div className={cn("space-y-8", data.body && "mt-12")}>
            {readableDocs.map((att) => {
              if (isPdf(att)) {
                return <PolicyPdfEmbed key={att.id} attachment={att} />;
              }

              const src = resolveAssetSrc({
                url: att.url,
                storageKey: att.storageKey,
              });
              if (!src) return null;

              if (isImage(att)) {
                return (
                  <figure key={att.id} className="space-y-3">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={src}
                      alt={att.fileName}
                      className="mx-auto max-h-[80vh] w-auto max-w-full rounded-sm object-contain"
                    />
                    <figcaption className="text-center text-xs text-muted-foreground">
                      {att.fileName}
                    </figcaption>
                  </figure>
                );
              }

              return (
                <figure key={att.id} className="space-y-3">
                  <video
                    src={src}
                    controls
                    className="mx-auto w-full max-w-3xl rounded-sm bg-black"
                  />
                  <figcaption className="text-center text-xs text-muted-foreground">
                    {att.fileName}
                  </figcaption>
                </figure>
              );
            })}
          </div>
        )}

        {otherFiles.length > 0 && (
          <footer className="mt-12 border-t border-border/40 pt-6">
            <p className="mb-3 text-xs font-medium text-muted-foreground">
              فایل‌های مرتبط
            </p>
            <ul className="space-y-2">
              {otherFiles.map((att) => (
                <li key={att.id}>
                  <button
                    type="button"
                    className="inline-flex items-center gap-2 text-sm text-foreground/80 underline-offset-4 hover:underline"
                    onClick={() => {
                      if (!att.storageKey) return;
                      void downloadStoredFile(att.storageKey, att.fileName).catch(
                        (err) =>
                          toast.error(
                            err instanceof Error
                              ? err.message
                              : "دانلود ناموفق بود",
                          ),
                      );
                    }}
                  >
                    <Download className="h-3.5 w-3.5" />
                    {att.fileName}
                  </button>
                </li>
              ))}
            </ul>
          </footer>
        )}
      </article>

      <KnowledgeFormDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        entry={data}
        defaultKind="POLICY"
      />
    </div>
  );
}
