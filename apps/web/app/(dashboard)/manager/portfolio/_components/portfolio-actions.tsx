"use client";

import Link from "next/link";
import {
  CheckCircle2,
  Eye,
  EyeOff,
  Film,
  MoreHorizontal,
  Pencil,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { PortfolioAdminItem } from "./types";

export function PortfolioActions({
  item,
  canEdit,
  canDelete,
  publishPending,
  onPreview,
  onEdit,
  onTogglePublish,
  onDelete,
}: {
  item: PortfolioAdminItem;
  canEdit: boolean;
  canDelete: boolean;
  publishPending?: boolean;
  onPreview: () => void;
  onEdit: () => void;
  onTogglePublish: () => void;
  onDelete: () => void;
}) {
  const published = item.status === "PUBLISHED";

  return (
    <div className="flex items-center justify-start gap-1">
      <Button
        size="sm"
        variant="outline"
        className="h-8 gap-1.5 rounded-lg px-2.5"
        onClick={onPreview}
      >
        <Eye className="h-3.5 w-3.5" />
        مشاهده
      </Button>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 rounded-lg"
            title="عملیات بیشتر"
            aria-label={`عملیات ${item.title}`}
          >
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-52 text-start">
          <DropdownMenuLabel>عملیات</DropdownMenuLabel>
          <DropdownMenuItem className="cursor-pointer" onClick={onPreview}>
            <Eye className="me-2 h-4 w-4" />
            مشاهده
          </DropdownMenuItem>
          {canEdit ? (
            <DropdownMenuItem className="cursor-pointer" onClick={onEdit}>
              <Pencil className="me-2 h-4 w-4" />
              ویرایش
            </DropdownMenuItem>
          ) : null}
          {item.project?.id ? (
            <DropdownMenuItem className="cursor-pointer" asChild>
              <Link href={`/projects/${item.project.id}`}>
                <Film className="me-2 h-4 w-4" />
                مشاهده پروژه
              </Link>
            </DropdownMenuItem>
          ) : null}
          {canEdit ? (
            <DropdownMenuItem
              className="cursor-pointer"
              disabled={publishPending}
              onClick={onTogglePublish}
            >
              {published ? (
                <>
                  <EyeOff className="me-2 h-4 w-4" />
                  تغییر وضعیت
                </>
              ) : (
                <>
                  <CheckCircle2 className="me-2 h-4 w-4" />
                  تغییر وضعیت
                </>
              )}
            </DropdownMenuItem>
          ) : null}
          {canDelete ? (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="cursor-pointer text-destructive focus:bg-destructive/10 focus:text-destructive"
                onClick={onDelete}
              >
                <Trash2 className="me-2 h-4 w-4" />
                حذف
              </DropdownMenuItem>
            </>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
