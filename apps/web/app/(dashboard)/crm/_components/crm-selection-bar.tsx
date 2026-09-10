"use client";

import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface CrmSelectionBarProps {
  selectedCount: number;
  selectedLabel: string;
  canDelete: boolean;
  bulkDeleteLabel: string;
  clearLabel: string;
  onBulkDelete: () => void;
  onClear: () => void;
  className?: string;
}

export function CrmSelectionBar({
  selectedCount,
  selectedLabel,
  canDelete,
  bulkDeleteLabel,
  clearLabel,
  onBulkDelete,
  onClear,
  className,
}: CrmSelectionBarProps) {
  if (selectedCount < 1) return null;

  return (
    <div
      role="region"
      aria-label={selectedLabel}
      className={cn(
        "flex flex-wrap items-center gap-2 rounded-lg border border-border bg-card px-3 py-2",
        className,
      )}
    >
      <p className="text-sm font-medium text-foreground">{selectedLabel}</p>
      <div className="flex flex-wrap items-center gap-2 sm:ms-auto">
        {canDelete ? (
          <Button
            type="button"
            variant="destructive"
            size="sm"
            className="h-9 gap-1.5"
            onClick={onBulkDelete}
          >
            <Trash2 className="h-4 w-4" />
            {bulkDeleteLabel}
          </Button>
        ) : null}
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-9 text-muted-foreground"
          onClick={onClear}
        >
          {clearLabel}
        </Button>
      </div>
    </div>
  );
}
