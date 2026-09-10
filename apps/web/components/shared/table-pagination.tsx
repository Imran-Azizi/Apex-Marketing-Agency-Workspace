"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  buildPageItems,
  formatLatnCount,
  pageRangeLabel,
} from "@/lib/pagination";

type TablePaginationProps = {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
  isFetching?: boolean;
  className?: string;
  /** When false, hide the range summary on very small screens. Default true. */
  showSummary?: boolean;
};

export function TablePagination({
  page,
  pageSize,
  total,
  onPageChange,
  isFetching = false,
  className,
  showSummary = true,
}: TablePaginationProps) {
  const totalPages = Math.max(1, Math.ceil(Math.max(0, total) / pageSize));
  const current = Math.min(Math.max(1, page), totalPages);
  const { from, to } = pageRangeLabel(current, pageSize, total);
  const items = buildPageItems(current, totalPages, 1);
  const disabled = isFetching || total === 0;

  if (total === 0) return null;

  return (
    <div
      className={cn(
        "mt-2 flex flex-col items-center justify-between gap-3 border-t border-border/70",
        "pb-3 pt-4 sm:flex-row",
        // Balanced inset; extra pe keeps controls clear of the fixed chat FAB.
        "ps-5 pe-24 sm:ps-8 sm:pe-28",
        className,
      )}
      dir="rtl"
    >
      {showSummary ? (
        <p className="text-sm text-muted-foreground">
          نمایش {formatLatnCount(from)} تا {formatLatnCount(to)} از{" "}
          {formatLatnCount(total)} نتیجه
          {totalPages > 1 ? (
            <>
              <span className="mx-1.5 text-border">·</span>
              صفحه {formatLatnCount(current)} از {formatLatnCount(totalPages)}
            </>
          ) : null}
        </p>
      ) : null}

      {totalPages > 1 ? (
        <nav
          className="flex flex-wrap items-center justify-center gap-1"
          aria-label="صفحه‌بندی"
        >
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-9 gap-1 px-2.5 sm:px-3"
            onClick={() => onPageChange(Math.max(1, current - 1))}
            disabled={disabled || current <= 1}
            aria-label="صفحه قبلی"
          >
            <ChevronRight className="h-4 w-4" />
            <span className="hidden sm:inline">قبلی</span>
          </Button>

          <div className="flex items-center gap-1">
            {items.map((item, index) => {
              if (item === "ellipsis") {
                return (
                  <span
                    key={`ellipsis-${index}`}
                    className="inline-flex h-9 min-w-9 items-center justify-center px-1 text-sm text-muted-foreground"
                    aria-hidden
                  >
                    …
                  </span>
                );
              }

              const active = item === current;
              return (
                <Button
                  key={item}
                  type="button"
                  variant={active ? "default" : "outline"}
                  size="sm"
                  className={cn(
                    "h-9 min-w-9 px-2 tabular-nums",
                    active &&
                      "pointer-events-none bg-foreground text-background hover:bg-foreground hover:text-background",
                  )}
                  onClick={() => onPageChange(item)}
                  disabled={disabled || active}
                  aria-label={`صفحه ${formatLatnCount(item)}`}
                  aria-current={active ? "page" : undefined}
                >
                  {formatLatnCount(item)}
                </Button>
              );
            })}
          </div>

          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-9 gap-1 px-2.5 sm:px-3"
            onClick={() => onPageChange(Math.min(totalPages, current + 1))}
            disabled={disabled || current >= totalPages}
            aria-label="صفحه بعدی"
          >
            <span className="hidden sm:inline">بعدی</span>
            <ChevronLeft className="h-4 w-4" />
          </Button>
        </nav>
      ) : null}
    </div>
  );
}
