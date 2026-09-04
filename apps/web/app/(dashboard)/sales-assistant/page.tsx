"use client";

import { Suspense, useEffect, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { RefreshCw } from "lucide-react";
import { apiGet, apiPatch, apiPost } from "@/lib/api";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useHasPermission } from "@/lib/permissions";
import {
  RecommendationCard,
  SummaryStat,
} from "./_components/recommendation-card";
import type {
  SalesAssistantInbox,
  SalesAssistantRecommendation,
  SalesAssistantSection,
} from "./_components/types";

function sectionOf(rec: SalesAssistantRecommendation): SalesAssistantSection {
  if (rec.section) return rec.section;
  if (rec.priority === "HIGH") return "urgent";
  if (rec.category === "REPEAT" || rec.kind === "REPEAT_ORDER") {
    return "opportunity";
  }
  return "followUp";
}

export default function SalesAssistantInboxPage() {
  return (
    <Suspense fallback={<Skeleton className="h-40 w-full" />}>
      <SalesAssistantInboxInner />
    </Suspense>
  );
}

function SalesAssistantInboxInner() {
  const searchParams = useSearchParams();
  const qc = useQueryClient();
  const canAct = useHasPermission(["sales_assistant.act", "crm.edit"]);
  const highlightId = searchParams.get("rec");

  const { data, isLoading, isError, isFetching, refetch } = useQuery({
    queryKey: ["sales-assistant-inbox"],
    queryFn: () =>
      apiGet<SalesAssistantInbox>("/sales-assistant/inbox?pageSize=100"),
    staleTime: 30_000,
  });

  const actMutation = useMutation({
    mutationFn: (payload: { id: string; actionState: string }) =>
      apiPatch(`/sales-assistant/recommendations/${payload.id}`, {
        actionState: payload.actionState,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["sales-assistant-inbox"] });
      toast.success("وضعیت توصیه به‌روز شد");
    },
    onError: () => toast.error("به‌روزرسانی ناموفق بود. دوباره تلاش کنید."),
  });

  const scanMutation = useMutation({
    mutationFn: () => apiPost("/sales-assistant/run", {}),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["sales-assistant-inbox"] });
      toast.success("پویش فروش شروع شد");
    },
    onError: () => toast.error("اجرای پویش ناموفق بود. دوباره تلاش کنید."),
  });

  const grouped = useMemo(() => {
    const items = data?.items || [];
    return {
      urgent: items.filter((r) => sectionOf(r) === "urgent"),
      followUp: items.filter((r) => sectionOf(r) === "followUp"),
      opportunity: items.filter((r) => sectionOf(r) === "opportunity"),
    };
  }, [data?.items]);

  useEffect(() => {
    if (!highlightId || isLoading || !data?.items?.length) return;
    const el = document.getElementById(`rec-${highlightId}`);
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [highlightId, isLoading, data?.items]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="صندوق توصیه فروش"
        subtitle="کدام مشتری نیاز به اقدام دارد، چرا مهم است، و الان چه کاری باید انجام دهید"
        actions={
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={isFetching}
              onClick={() => refetch()}
            >
              <RefreshCw
                className={`ms-1 h-4 w-4 ${isFetching ? "animate-spin" : ""}`}
              />
              به‌روزرسانی
            </Button>
            {canAct ? (
              <Button
                variant="outline"
                size="sm"
                disabled={scanMutation.isPending}
                onClick={() => scanMutation.mutate()}
              >
                اجرای پویش
              </Button>
            ) : null}
          </div>
        }
      />

      {isLoading ? (
        <div className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
          </div>
          <Skeleton className="h-36 w-full" />
          <Skeleton className="h-36 w-full" />
        </div>
      ) : isError ? (
        <EmptyState
          title="بارگذاری توصیه‌ها ناموفق بود"
          description="لطفاً دوباره تلاش کنید. اگر مشکل ادامه داشت با پشتیبانی سیستم هماهنگ شوید."
        />
      ) : !data?.items?.length ? (
        <EmptyState
          title="در حال حاضر توصیه‌ای برای اقدام وجود ندارد."
          description="وقتی مشتری در انتظار تصمیم، بیعانه، یا فرصت سفارش تکراری باشد، پیشنهادهای عملی اینجا نمایش داده می‌شود."
        />
      ) : (
        <>
          <section className="space-y-3">
            <h2 className="text-base font-semibold">خلاصه توصیه‌ها</h2>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <SummaryStat
                label="توصیه‌های جدید"
                value={data.stats.newCount ?? 0}
              />
              <SummaryStat
                label="نیاز به اقدام فوری"
                value={data.stats.urgent ?? data.stats.high ?? 0}
                tone="urgent"
              />
              <SummaryStat
                label="پیگیری‌های پیشنهادی"
                value={data.stats.followUp ?? 0}
                tone="follow"
              />
              <SummaryStat
                label="فرصت‌های فروش"
                value={data.stats.opportunity ?? 0}
                tone="opportunity"
              />
            </div>
          </section>

          <Section
            title="نیاز به اقدام فوری"
            tone="urgent"
            items={grouped.urgent}
            empty="مورد فوری برای پیگیری وجود ندارد."
            highlightId={highlightId}
            canAct={canAct}
            acting={actMutation.isPending}
            onAct={(id, actionState) =>
              actMutation.mutate({ id, actionState })
            }
          />

          <Section
            title="پیگیری پیشنهادی"
            tone="follow"
            items={grouped.followUp}
            empty="پیگیری پیشنهادی جدیدی ثبت نشده است."
            highlightId={highlightId}
            canAct={canAct}
            acting={actMutation.isPending}
            onAct={(id, actionState) =>
              actMutation.mutate({ id, actionState })
            }
          />

          <Section
            title="فرصت‌های فروش"
            tone="opportunity"
            items={grouped.opportunity}
            empty="فرصت فروش فعالی شناسایی نشده است."
            highlightId={highlightId}
            canAct={canAct}
            acting={actMutation.isPending}
            onAct={(id, actionState) =>
              actMutation.mutate({ id, actionState })
            }
          />
        </>
      )}
    </div>
  );
}

function Section({
  title,
  tone,
  items,
  empty,
  highlightId,
  canAct,
  acting,
  onAct,
}: {
  title: string;
  tone: "urgent" | "follow" | "opportunity";
  items: SalesAssistantRecommendation[];
  empty: string;
  highlightId: string | null;
  canAct: boolean;
  acting: boolean;
  onAct: (id: string, actionState: "DONE" | "DISMISSED" | "IN_PROGRESS") => void;
}) {
  const bar =
    tone === "urgent"
      ? "border-s-4 border-s-destructive"
      : tone === "follow"
        ? "border-s-4 border-s-amber-500"
        : "border-s-4 border-s-emerald-500";

  return (
    <section className="space-y-3">
      <h2 className={`rounded-md bg-muted/40 px-3 py-2 text-base font-semibold ${bar}`}>
        {title}
      </h2>
      {!items.length ? (
        <p className="text-sm text-muted-foreground">{empty}</p>
      ) : (
        <div className="space-y-3">
          {items.map((rec) => (
            <div
              key={rec.id}
              id={`rec-${rec.id}`}
              className={
                highlightId === rec.id
                  ? "rounded-lg ring-2 ring-brand/40"
                  : undefined
              }
            >
              <RecommendationCard
                rec={rec}
                canAct={canAct}
                acting={acting}
                onAct={(actionState) => onAct(rec.id, actionState)}
              />
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
