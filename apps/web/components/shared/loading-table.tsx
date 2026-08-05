import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface LoadingTableProps {
  columns?: number;
  rows?: number;
  className?: string;
}

export function LoadingTable({
  columns = 5,
  rows = 6,
  className,
}: LoadingTableProps) {
  return (
    <div
      className={
        className
          ? `overflow-hidden rounded-lg border border-border bg-card ${className}`
          : "overflow-hidden rounded-lg border border-border bg-card"
      }
      aria-busy="true"
      aria-label="در حال بارگذاری جدول"
    >
      <Table>
        <TableHeader>
          <TableRow>
            {Array.from({ length: columns }).map((_, i) => (
              <TableHead key={i}>
                <Skeleton className="h-4 w-24" />
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {Array.from({ length: rows }).map((_, row) => (
            <TableRow key={row}>
              {Array.from({ length: columns }).map((_, col) => (
                <TableCell key={col}>
                  <Skeleton
                    className="h-4 w-full"
                    style={{
                      maxWidth: col === 0 ? 140 : 100 + ((row + col) % 3) * 20,
                    }}
                  />
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
