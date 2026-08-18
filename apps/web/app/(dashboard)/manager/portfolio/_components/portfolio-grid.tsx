import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatDate } from "@/lib/utils";
import { PortfolioActions } from "./portfolio-actions";
import { PortfolioCard } from "./portfolio-card";
import { PortfolioThumbnail } from "./portfolio-thumbnail";
import type { PortfolioAdminItem } from "./types";

export function PortfolioGrid({
  items,
  canEdit,
  canDelete,
  publishPendingId,
  onPreview,
  onEdit,
  onTogglePublish,
  onDelete,
}: {
  items: PortfolioAdminItem[];
  canEdit: boolean;
  canDelete: boolean;
  publishPendingId?: string | null;
  onPreview: (item: PortfolioAdminItem) => void;
  onEdit: (item: PortfolioAdminItem) => void;
  onTogglePublish: (item: PortfolioAdminItem) => void;
  onDelete: (item: PortfolioAdminItem) => void;
}) {
  return (
    <>
      <div className="grid gap-4 md:hidden">
        {items.map((item) => (
          <PortfolioCard
            key={item.id}
            item={item}
            canEdit={canEdit}
            canDelete={canDelete}
            publishPending={publishPendingId === item.id}
            onPreview={() => onPreview(item)}
            onEdit={() => onEdit(item)}
            onTogglePublish={() => onTogglePublish(item)}
            onDelete={() => onDelete(item)}
          />
        ))}
      </div>

      <div className="hidden overflow-hidden rounded-2xl border border-border/70 bg-card md:block" dir="rtl">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[140px] text-start">تصویر</TableHead>
              <TableHead className="text-start">عنوان</TableHead>
              <TableHead className="text-start">کتگوری</TableHead>
              <TableHead className="text-start">وضعیت</TableHead>
              <TableHead className="text-start">ترتیب</TableHead>
              <TableHead className="text-start">تاریخ</TableHead>
              <TableHead className="text-start">عملیات</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((item) => {
              const published = item.status === "PUBLISHED";
              return (
                <TableRow key={item.id}>
                  <TableCell className="p-2">
                    <div className="w-[120px] overflow-hidden rounded-lg">
                      <PortfolioThumbnail
                        thumbnailUrl={item.thumbnailUrl}
                        title={item.title}
                        onPreview={() => onPreview(item)}
                      />
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="max-w-xs">
                      <p className="font-medium text-foreground">{item.title}</p>
                      {item.inMixed ? (
                        <p className="mt-1 text-[11px] text-brand">در مختلط</p>
                      ) : null}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex max-w-[14rem] flex-wrap gap-1">
                      {item.categories.length ? (
                        item.categories.map((category) => (
                          <Badge key={category.id} variant="outline" className="font-normal">
                            {category.name}
                          </Badge>
                        ))
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={published ? "success" : "secondary"}>
                      {published ? "فعال" : "غیرفعال"}
                    </Badge>
                  </TableCell>
                  <TableCell className="tabular-nums">{item.sortOrder}</TableCell>
                  <TableCell className="whitespace-nowrap text-muted-foreground">
                    {formatDate(item.publishedAt || item.createdAt)}
                  </TableCell>
                  <TableCell>
                    <PortfolioActions
                      item={item}
                      canEdit={canEdit}
                      canDelete={canDelete}
                      publishPending={publishPendingId === item.id}
                      onPreview={() => onPreview(item)}
                      onEdit={() => onEdit(item)}
                      onTogglePublish={() => onTogglePublish(item)}
                      onDelete={() => onDelete(item)}
                    />
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </>
  );
}
