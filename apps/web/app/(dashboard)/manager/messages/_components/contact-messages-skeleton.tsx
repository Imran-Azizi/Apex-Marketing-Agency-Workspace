import { Skeleton } from "@/components/ui/skeleton";
import { HorizontalScroll } from "@/components/shared/horizontal-scroll";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export function ContactMessagesSkeleton({ rows = 8 }: { rows?: number }) {
  return (
    <div
      className="overflow-hidden rounded-2xl border border-border/70 bg-card shadow-sm"
      aria-busy="true"
      aria-label="در حال بارگذاری جدول پیام‌ها"
    >
      <HorizontalScroll bordered={false}>
        <Table scrollContainer={false} className="min-w-[56rem]">
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              {[
                "وضعیت",
                "مشتری",
                "موضوع",
                "شرکت",
                "شماره تماس",
                "ایمیل",
                "تاریخ",
                "عملیات",
              ].map((label) => (
                <TableHead
                  key={label}
                  className="whitespace-nowrap text-[11px] font-semibold text-muted-foreground"
                >
                  {label}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {Array.from({ length: rows }).map((_, row) => (
              <TableRow key={row} className="hover:bg-transparent">
                <TableCell>
                  <Skeleton className="h-6 w-[4.5rem] rounded-full" />
                </TableCell>
                <TableCell>
                  <Skeleton className="h-4 w-28" />
                </TableCell>
                <TableCell>
                  <Skeleton className="h-4 w-24" />
                </TableCell>
                <TableCell>
                  <Skeleton className="h-4 w-20" />
                </TableCell>
                <TableCell>
                  <Skeleton className="h-4 w-28" />
                </TableCell>
                <TableCell>
                  <Skeleton className="h-4 w-36" />
                </TableCell>
                <TableCell>
                  <Skeleton className="h-4 w-32" />
                </TableCell>
                <TableCell>
                  <Skeleton className="mx-auto h-8 w-8 rounded-lg" />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </HorizontalScroll>
    </div>
  );
}
