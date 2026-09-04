"use client";

import { Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { formatMoney, type FinanceProject } from "./types";
import {
  customerListDisplay,
  PaymentProgressBar,
  settlementBadgeVariant,
  settlementLabel,
} from "./finance-project-ui";

type FinanceProjectsTableProps = {
  items: FinanceProject[];
  onSelect: (project: FinanceProject) => void;
};

export function FinanceProjectsTable({
  items,
  onSelect,
}: FinanceProjectsTableProps) {
  return (
    <div className="overflow-hidden rounded-xl border border-border/60 bg-card">
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-muted/40">
            <TableHead className="sticky top-0 z-10 bg-muted/95 text-xs backdrop-blur supports-[backdrop-filter]:bg-muted/80">
              نام پروژه
            </TableHead>
            <TableHead className="sticky top-0 z-10 bg-muted/95 text-xs backdrop-blur supports-[backdrop-filter]:bg-muted/80">
              نام مشتری
            </TableHead>
            <TableHead className="sticky top-0 z-10 bg-muted/95 text-xs backdrop-blur supports-[backdrop-filter]:bg-muted/80">
              شناسه پروژه
            </TableHead>
            <TableHead className="sticky top-0 z-10 bg-muted/95 text-xs backdrop-blur supports-[backdrop-filter]:bg-muted/80">
              مبلغ کل
            </TableHead>
            <TableHead className="sticky top-0 z-10 bg-muted/95 text-xs backdrop-blur supports-[backdrop-filter]:bg-muted/80">
              پرداخت‌شده
            </TableHead>
            <TableHead className="sticky top-0 z-10 bg-muted/95 text-xs backdrop-blur supports-[backdrop-filter]:bg-muted/80">
              مانده
            </TableHead>
            <TableHead className="sticky top-0 z-10 bg-muted/95 text-xs backdrop-blur supports-[backdrop-filter]:bg-muted/80 min-w-[8.5rem]">
              پیشرفت پرداخت
            </TableHead>
            <TableHead className="sticky top-0 z-10 bg-muted/95 text-xs backdrop-blur supports-[backdrop-filter]:bg-muted/80 w-[7.5rem]">
              عملیات
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((project) => (
            <TableRow
              key={project.id}
              className="cursor-pointer"
              onClick={() => onSelect(project)}
            >
              <TableCell className="max-w-[14rem] py-3">
                <div className="truncate font-medium text-foreground">
                  {project.title}
                </div>
                <Badge
                  variant={settlementBadgeVariant(project.settlementStatus)}
                  className="mt-1 font-normal"
                >
                  {settlementLabel(project)}
                </Badge>
              </TableCell>
              <TableCell className="max-w-[10rem] py-3">
                {(() => {
                  const { primary, secondary } = customerListDisplay(
                    project.customer,
                  );
                  return (
                    <>
                      <div className="truncate text-sm">{primary}</div>
                      {secondary ? (
                        <div className="truncate text-xs text-muted-foreground">
                          {secondary}
                        </div>
                      ) : null}
                    </>
                  );
                })()}
              </TableCell>
              <TableCell className="whitespace-nowrap py-3 text-xs tabular-nums text-muted-foreground">
                {project.code}
              </TableCell>
              <TableCell className="whitespace-nowrap py-3 text-sm font-medium tabular-nums">
                {formatMoney(project.finalProjectPrice, project.currency)}
              </TableCell>
              <TableCell className="whitespace-nowrap py-3 text-sm tabular-nums text-emerald-700 dark:text-emerald-300">
                {formatMoney(project.received, project.currency)}
              </TableCell>
              <TableCell className="whitespace-nowrap py-3 text-sm tabular-nums text-amber-800 dark:text-amber-300">
                {formatMoney(project.balance, project.currency)}
              </TableCell>
              <TableCell className="py-3">
                <PaymentProgressBar
                  total={project.finalProjectPrice}
                  paid={project.received}
                  compact
                />
              </TableCell>
              <TableCell className="py-3">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className={cn("h-8 gap-1.5 px-2 text-xs font-medium")}
                  onClick={(event) => {
                    event.stopPropagation();
                    onSelect(project);
                  }}
                >
                  <Eye className="size-3.5" />
                  مشاهده جزئیات
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
