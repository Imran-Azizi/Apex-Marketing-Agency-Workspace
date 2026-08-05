"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { apiGet } from "@/lib/api";
import { formatDate } from "@/lib/utils";
import { PageHeader } from "@/components/shared/page-header";
import { LoadingTable } from "@/components/shared/loading-table";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface CrmCustomer {
  id: string;
  personName: string;
  companyName: string | null;
  lastContactAt: string | null;
  nextFollowUpAt: string | null;
  notes: string | null;
}

interface CrmListResponse {
  items: CrmCustomer[];
  total: number;
}

export default function SalesInteractionsPage() {
  const { data, isLoading, error } = useQuery({
    queryKey: ["sales-interactions"],
    queryFn: () =>
      apiGet<CrmListResponse>("/crm/customers?page=1&pageSize=50"),
  });

  return (
    <div>
      <PageHeader
        title="تعاملات مشتری"
        subtitle="پیگیری تماس‌ها، یادداشت‌های فروش و سررسیدهای پیگیری"
      />

      {isLoading && <LoadingTable columns={4} />}
      {error && (
        <EmptyState
          title="بارگذاری تعاملات ناموفق بود"
          description="لطفاً دوباره تلاش کنید."
        />
      )}
      {data && data.items.length === 0 && (
        <EmptyState
          title="تعاملی ثبت نشده"
          description="با ایجاد مشتری در CRM، تعاملات اینجا نمایش داده می‌شود."
          action={
            <Button asChild variant="brand">
              <Link href="/crm">رفتن به CRM</Link>
            </Button>
          }
        />
      )}

      {data && data.items.length > 0 && (
        <div className="overflow-x-auto rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/40 hover:bg-muted/40">
                <TableHead>مشتری</TableHead>
                <TableHead>آخرین تماس</TableHead>
                <TableHead>پیگیری بعدی</TableHead>
                <TableHead>یادداشت فروش</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.items.map((c) => (
                <TableRow key={c.id}>
                  <TableCell>
                    <Link
                      href={`/crm/${c.id}`}
                      className="font-medium text-brand hover:underline"
                    >
                      {c.personName}
                    </Link>
                    {c.companyName && (
                      <span className="block text-xs text-muted-foreground">
                        {c.companyName}
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {c.lastContactAt ? formatDate(c.lastContactAt) : "—"}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {c.nextFollowUpAt ? formatDate(c.nextFollowUpAt) : "—"}
                  </TableCell>
                  <TableCell className="max-w-xs truncate text-sm">
                    {c.notes || "—"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
