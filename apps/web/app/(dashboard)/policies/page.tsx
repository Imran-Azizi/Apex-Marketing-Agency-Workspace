"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, Plus, Search } from "lucide-react";
import { apiGet } from "@/lib/api";
import { cn, formatDateTime } from "@/lib/utils";
import { useHasPermission } from "@/lib/permissions";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { UserAvatar } from "@/components/shared/user-avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { KnowledgeFormDialog } from "../knowledge/_components/knowledge-form-dialog";
import {
  STATUS_BADGE_VARIANTS,
  STATUS_LABELS,
  type KnowledgeListResponse,
  type KnowledgeStatus,
} from "../knowledge/_components/types";

const PAGE_SIZE = 12;
const ALL = "ALL";

export default function PoliciesPage() {
  const canManagePolicies = useHasPermission("knowledge.manage");

  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState(ALL);
  const [page, setPage] = useState(1);
  const [formOpen, setFormOpen] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, 400);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const listParams = useMemo(() => {
    const params = new URLSearchParams();
    params.set("page", String(page));
    params.set("pageSize", String(PAGE_SIZE));
    params.set("kind", "POLICY");
    if (search) params.set("q", search);
    if (status !== ALL) params.set("status", status);
    return params.toString();
  }, [page, search, status]);

  const { data, isLoading, isFetching, error } = useQuery({
    queryKey: ["knowledge", "list", listParams],
    queryFn: () => apiGet<KnowledgeListResponse>(`/knowledge?${listParams}`),
    placeholderData: keepPreviousData,
  });

  const items = data?.items || [];
  const totalPages = data?.totalPages || 1;

  return (
    <div className="space-y-6">
      <PageHeader
        title="پالیسی‌های شرکت"
        subtitle="قوانین و معیارهای رسمی کاری — هر نقش فقط پالیسی‌های خودش را می‌بیند"
        actions={
          canManagePolicies && (
            <Button onClick={() => setFormOpen(true)}>
              <Plus className="ml-1.5 h-4 w-4" />
              پالیسی جدید
            </Button>
          )
        }
      />

      {data?.roleAudienceLabel && (
        <p className="text-sm text-muted-foreground">
          در حال مشاهده پالیسی‌های نقش{" "}
          <span className="font-medium text-foreground">
            {data.roleAudienceLabel}
          </span>
        </p>
      )}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="جستجو در پالیسی‌ها…"
            className="pr-9"
          />
        </div>
        <Select
          value={status}
          onValueChange={(v) => {
            setStatus(v);
            setPage(1);
          }}
        >
          <SelectTrigger className="w-full sm:w-40">
            <SelectValue placeholder="وضعیت" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>همه وضعیت‌ها</SelectItem>
            <SelectItem value="PUBLISHED">منتشرشده</SelectItem>
            <SelectItem value="DRAFT">پیش‌نویس</SelectItem>
            <SelectItem value="ARCHIVED">آرشیف</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {error ? (
        <EmptyState
          title="خطا در بارگذاری"
          description="دریافت فهرست پالیسی‌ها با مشکل مواجه شد."
        />
      ) : isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="h-44 animate-pulse rounded-2xl border bg-muted/40"
            />
          ))}
        </div>
      ) : items.length === 0 ? (
        <EmptyState
          title="پالیسی‌ای یافت نشد"
          description="پالیسی‌های رسمی مرتبط با نقش شما اینجا نمایش داده می‌شوند."
          action={
            canManagePolicies && (
              <Button onClick={() => setFormOpen(true)}>
                <Plus className="ml-1.5 h-4 w-4" />
                پالیسی جدید
              </Button>
            )
          }
        />
      ) : (
        <div
          className={cn(
            "grid gap-4 sm:grid-cols-2 xl:grid-cols-3",
            isFetching && "opacity-70",
          )}
        >
          {items.map((item) => (
            <Link
              key={item.id}
              href={`/policies/${item.id}`}
              className="group flex flex-col rounded-2xl border border-border/70 bg-card p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-md"
            >
              <div className="mb-3 flex flex-wrap gap-2">
                <Badge variant={STATUS_BADGE_VARIANTS[item.status]}>
                  {STATUS_LABELS[item.status as KnowledgeStatus] ||
                    item.statusLabel}
                </Badge>
                <Badge variant="outline">{item.roleAudienceLabel}</Badge>
              </div>
              <h3 className="line-clamp-2 text-base font-semibold leading-7 group-hover:text-primary">
                {item.title}
              </h3>
              {item.summary && (
                <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">
                  {item.summary}
                </p>
              )}
              <div className="mt-auto flex items-center justify-between gap-3 pt-4 text-xs text-muted-foreground">
                <div className="flex min-w-0 items-center gap-2">
                  <UserAvatar
                    name={item.author?.fullName}
                    profileImage={item.author?.profileImage}
                    className="h-7 w-7"
                  />
                  <span className="truncate">
                    {item.author?.fullName || "—"}
                  </span>
                </div>
                <span className="shrink-0">
                  {formatDateTime(item.publishedAt || item.createdAt)}
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}

      {data && data.totalPages > 1 && (
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm text-muted-foreground">
            صفحه {data.page} از {totalPages} · {data.total} مورد
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="icon"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      <KnowledgeFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        defaultKind="POLICY"
      />
    </div>
  );
}
