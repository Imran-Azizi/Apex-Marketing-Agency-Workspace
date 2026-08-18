"use client";

import { Eye, EyeOff, GripVertical, Pencil, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CustomerCard } from "@/components/public/customers/customer-card";
import type { ShowcaseCustomer } from "@/lib/customers";
import { cn, formatDate } from "@/lib/utils";

export function CustomerList({
  items,
  canEdit,
  canDelete,
  reorderEnabled,
  pendingId,
  onPreview,
  onEdit,
  onTogglePublish,
  onDelete,
  onReorder,
}: {
  items: ShowcaseCustomer[];
  canEdit: boolean;
  canDelete: boolean;
  reorderEnabled: boolean;
  pendingId?: string | null;
  onPreview: (customer: ShowcaseCustomer) => void;
  onEdit: (customer: ShowcaseCustomer) => void;
  onTogglePublish: (customer: ShowcaseCustomer) => void;
  onDelete: (customer: ShowcaseCustomer) => void;
  onReorder: (fromId: string, toId: string) => void;
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
      {items.map((customer, index) => {
        const published = customer.isPublished === true;
        const busy = pendingId === customer.id;
        return (
          <div
            key={customer.id}
            draggable={canEdit && reorderEnabled}
            onDragStart={(e) => {
              e.dataTransfer.setData("text/plain", customer.id);
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
              if (fromId && fromId !== customer.id) onReorder(fromId, customer.id);
            }}
            className={cn(
              canEdit && reorderEnabled && "cursor-grab active:cursor-grabbing",
            )}
          >
            <CustomerCard
              customer={customer}
              index={index}
              className={cn(!published && "border-dashed opacity-90")}
              header={
                <div className="mb-2 flex w-full items-center justify-between gap-2">
                  <div className="flex min-w-0 items-center gap-1">
                    {canEdit && reorderEnabled ? (
                      <GripVertical
                        className="h-3.5 w-3.5 shrink-0 text-muted-foreground"
                        aria-hidden
                      />
                    ) : null}
                    <Badge
                      variant="outline"
                      className="h-5 px-1.5 text-[10px] tabular-nums"
                    >
                      {customer.sortOrder ?? index + 1}
                    </Badge>
                  </div>
                  <Badge
                    variant={published ? "success" : "secondary"}
                    className="h-5 px-1.5 text-[10px]"
                  >
                    {published ? "فعال" : "غیرفعال"}
                  </Badge>
                </div>
              }
              footer={
                <div className="space-y-2">
                  <p className="text-center text-[10px] text-muted-foreground">
                    {customer.createdAt ? formatDate(customer.createdAt) : "—"}
                  </p>
                  <div className="flex w-full items-center gap-1">
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8 min-w-0 flex-1 gap-1 px-1.5 text-[11px]"
                      onClick={() => onPreview(customer)}
                    >
                      <Eye className="h-3 w-3 shrink-0" />
                      <span className="truncate">مشاهده</span>
                    </Button>
                    {canEdit ? (
                      <>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-8 min-w-0 flex-1 gap-1 px-1.5 text-[11px]"
                          onClick={() => onEdit(customer)}
                        >
                          <Pencil className="h-3 w-3 shrink-0" />
                          <span className="truncate">ویرایش</span>
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-8 min-w-0 flex-1 gap-1 px-1.5 text-[11px]"
                          disabled={busy}
                          onClick={() => onTogglePublish(customer)}
                        >
                          {published ? (
                            <EyeOff className="h-3 w-3 shrink-0" />
                          ) : (
                            <Eye className="h-3 w-3 shrink-0" />
                          )}
                          <span className="truncate">
                            {published ? "غیرفعال" : "فعال"}
                          </span>
                        </Button>
                      </>
                    ) : null}
                    {canDelete ? (
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8 min-w-0 flex-1 gap-1 px-1.5 text-[11px] text-destructive hover:bg-destructive/10 hover:text-destructive"
                        onClick={() => onDelete(customer)}
                      >
                        <Trash2 className="h-3 w-3 shrink-0" />
                        <span className="truncate">حذف</span>
                      </Button>
                    ) : null}
                  </div>
                </div>
              }
            />
          </div>
        );
      })}
    </div>
  );
}
