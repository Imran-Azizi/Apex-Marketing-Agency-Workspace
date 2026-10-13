import { formatCount } from "@/lib/contract-project";
import type { CalendarRow } from "@/lib/contract-workspace";
import { cn, formatDate } from "@/lib/utils";
import { HorizontalScroll } from "@/components/shared/horizontal-scroll";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const VIDEO_TYPES = new Set(["ریلز", "ویدیو", "استوری"]);

export function CalendarTable({ rows }: { rows: CalendarRow[] }) {
  return (
    <HorizontalScroll className="rounded-xl border border-border/70">
      <Table scrollContainer={false} className="min-w-[40rem]">
        <TableHeader>
          <TableRow className="bg-muted/40 hover:bg-muted/40">
            <TableHead className="w-16 text-center">شماره</TableHead>
            <TableHead className="min-w-[14rem]">موضوع</TableHead>
            <TableHead className="whitespace-nowrap">نوعیت محتوا</TableHead>
            <TableHead className="whitespace-nowrap">زبان</TableHead>
            <TableHead className="whitespace-nowrap">تاریخ نشر</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row, index) => (
            <TableRow key={index}>
              <TableCell className="text-center text-xs font-semibold tabular-nums text-muted-foreground">
                {formatCount(index + 1)}
              </TableCell>
              <TableCell className="font-medium leading-6">{row.topic}</TableCell>
              <TableCell>
                <span
                  className={cn(
                    "inline-flex rounded-md px-2 py-0.5 text-xs font-semibold",
                    VIDEO_TYPES.has(row.contentType)
                      ? "bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300"
                      : "bg-muted text-foreground",
                  )}
                >
                  {row.contentType}
                </span>
              </TableCell>
              <TableCell className="text-sm">{row.language}</TableCell>
              <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                {row.publishDate ? formatDate(row.publishDate) : "—"}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </HorizontalScroll>
  );
}
