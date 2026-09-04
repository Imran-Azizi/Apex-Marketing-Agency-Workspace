"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { apiGet } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toEnglishDigits } from "@/lib/utils";
import type { SalesAssistantInbox } from "@/app/(dashboard)/sales-assistant/_components/types";
import {
  PRIORITY_LABELS,
  customerLabel,
} from "@/app/(dashboard)/sales-assistant/_components/types";

export function CustomerSalesAssistantCard({ customerId }: { customerId: string }) {
  const { data } = useQuery({
    queryKey: ["sales-assistant-inbox", "customer", customerId],
    queryFn: () =>
      apiGet<SalesAssistantInbox>(
        `/sales-assistant/inbox?customerId=${encodeURIComponent(customerId)}&pageSize=3`,
      ),
  });

  const items = data?.items || [];
  if (!items.length) return null;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2">
        <CardTitle className="text-base">توصیه‌های فروش</CardTitle>
        <Button variant="outline" size="sm" asChild>
          <Link href="/sales-assistant">صندوق توصیه</Link>
        </Button>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        {items.map((rec) => (
          <div key={rec.id} className="rounded-lg border p-3">
            <div className="mb-1 flex flex-wrap items-center gap-2">
              <span className="font-medium">{customerLabel(rec)}</span>
              <Badge variant="outline">
                اولویت {PRIORITY_LABELS[rec.priority] || rec.priority}
              </Badge>
            </div>
            <p className="text-muted-foreground">
              {toEnglishDigits(rec.recommendedAction || rec.reason)}
            </p>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
