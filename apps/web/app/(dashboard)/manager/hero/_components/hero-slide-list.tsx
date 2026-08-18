"use client";

import {
  ArrowDown,
  ArrowUp,
  Eye,
  EyeOff,
  GripVertical,
  Pencil,
  Trash2,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { heroImageSrc, type HeroSlide } from "@/lib/hero";
import { cn, formatDate } from "@/lib/utils";

export function HeroSlideList({
  items,
  canEdit,
  canDelete,
  reorderEnabled,
  pendingId,
  onPreview,
  onEdit,
  onTogglePublish,
  onDelete,
  onMove,
  onReorder,
}: {
  items: HeroSlide[];
  canEdit: boolean;
  canDelete: boolean;
  reorderEnabled: boolean;
  pendingId?: string | null;
  onPreview: (slide: HeroSlide) => void;
  onEdit: (slide: HeroSlide) => void;
  onTogglePublish: (slide: HeroSlide) => void;
  onDelete: (slide: HeroSlide) => void;
  onMove: (id: string, direction: -1 | 1) => void;
  onReorder: (fromId: string, toId: string) => void;
}) {
  return (
    <div className="space-y-3">
      {items.map((slide, index) => {
        const img = heroImageSrc(slide);
        const published = slide.isPublished === true;
        const busy = pendingId === slide.id;
        return (
          <article
            key={slide.id}
            draggable={canEdit && reorderEnabled}
            onDragStart={(e) => {
              e.dataTransfer.setData("text/plain", slide.id);
              e.dataTransfer.effectAllowed = "move";
            }}
            onDragOver={(e) => {
              if (!canEdit || !reorderEnabled) return;
              e.preventDefault();
              e.dataTransfer.dropEffect = "move";
            }}
            onDrop={(e) => {
              e.preventDefault();
              const fromId = e.dataTransfer.getData("text/plain");
              if (fromId && fromId !== slide.id) onReorder(fromId, slide.id);
            }}
            className={cn(
              "flex flex-col overflow-hidden rounded-2xl border bg-card shadow-sm sm:flex-row",
              published
                ? "border-border/70"
                : "border-dashed border-border/80 opacity-90",
              canEdit && reorderEnabled && "cursor-grab active:cursor-grabbing",
            )}
          >
            <div className="relative aspect-[16/9] w-full shrink-0 bg-muted sm:aspect-auto sm:w-52">
              {img ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={img}
                  alt={slide.altText || slide.title}
                  className="h-full w-full object-cover sm:absolute sm:inset-0"
                />
              ) : (
                <div className="flex h-full min-h-[7rem] items-center justify-center text-xs text-muted-foreground">
                  بدون تصویر
                </div>
              )}
            </div>
            <div className="flex min-w-0 flex-1 flex-col gap-3 p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    {canEdit && reorderEnabled ? (
                      <GripVertical
                        className="h-4 w-4 text-muted-foreground"
                        aria-hidden
                      />
                    ) : null}
                    <Badge variant="outline" className="tabular-nums">
                      ترتیب {slide.sortOrder ?? index + 1}
                    </Badge>
                    <Badge variant={published ? "success" : "secondary"}>
                      {published ? "فعال" : "غیرفعال"}
                    </Badge>
                  </div>
                  <h3 className="truncate text-base font-semibold">
                    {slide.title}
                  </h3>
                  {slide.description ? (
                    <p className="line-clamp-2 text-xs leading-6 text-muted-foreground">
                      {slide.description}
                    </p>
                  ) : null}
                  <p className="text-[11px] text-muted-foreground">
                    به‌روزرسانی:{" "}
                    {slide.updatedAt ? formatDate(slide.updatedAt) : "—"}
                  </p>
                </div>
              </div>

              <div className="mt-auto flex flex-wrap gap-1.5">
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1"
                  onClick={() => onPreview(slide)}
                >
                  <Eye className="h-3.5 w-3.5" />
                  پیش‌نمایش
                </Button>
                {canEdit ? (
                  <>
                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-1"
                      onClick={() => onEdit(slide)}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                      ویرایش
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-1"
                      disabled={busy}
                      onClick={() => onTogglePublish(slide)}
                    >
                      {published ? (
                        <EyeOff className="h-3.5 w-3.5" />
                      ) : (
                        <Eye className="h-3.5 w-3.5" />
                      )}
                      {published ? "غیرفعال" : "فعال"}
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8"
                      disabled={index === 0 || busy || !reorderEnabled}
                      onClick={() => onMove(slide.id, -1)}
                      aria-label="انتقال به بالا"
                    >
                      <ArrowUp className="h-4 w-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8"
                      disabled={
                        index === items.length - 1 || busy || !reorderEnabled
                      }
                      onClick={() => onMove(slide.id, 1)}
                      aria-label="انتقال به پایین"
                    >
                      <ArrowDown className="h-4 w-4" />
                    </Button>
                  </>
                ) : null}
                {canDelete ? (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="gap-1 text-destructive hover:text-destructive"
                    onClick={() => onDelete(slide)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    حذف
                  </Button>
                ) : null}
              </div>
            </div>
          </article>
        );
      })}
    </div>
  );
}
