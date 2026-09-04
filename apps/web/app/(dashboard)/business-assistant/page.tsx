"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { RefreshCw } from "lucide-react";
import { apiGet } from "@/lib/api";
import { PageHeader } from "@/components/shared/page-header";
import { HorizontalScroll } from "@/components/shared/horizontal-scroll";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ActionItem, BulletCard } from "./_components/briefing-ui";
import { PerformanceChart } from "./_components/performance-chart";
import {
  formatCount,
  formatDateTimeEn,
  formatMoneyEn,
  withEnglishDigits,
} from "./_components/display";
import type { BusinessBriefingPayload } from "./_components/types";
import { formatTrendPct } from "./_components/types";

function KpiCard({
  label,
  value,
  trend,
}: {
  label: string;
  value: string;
  trend?: string;
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {label}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-lg font-semibold tabular-nums" dir="ltr">
          {value}
        </p>
        {trend ? (
          <Badge variant="outline" className="mt-2 tabular-nums" dir="ltr">
            {trend}
          </Badge>
        ) : null}
      </CardContent>
    </Card>
  );
}

function OverviewPanel({
  data,
}: {
  data: BusinessBriefingPayload;
}) {
  const { kpis, briefing } = data;

  return (
    <div className="space-y-6">
      <section className="space-y-3">
        <h2 className="text-base font-semibold">شاخص‌های کلیدی</h2>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <KpiCard
            label="دریافتی ماه"
            value={formatMoneyEn(kpis.received)}
            trend={
              kpis.trends?.revenuePct != null
                ? `${formatTrendPct(kpis.trends.revenuePct)} vs ماه قبل`
                : undefined
            }
          />
          <KpiCard
            label="سود خالص ماه"
            value={formatMoneyEn(kpis.netProfit)}
            trend={
              kpis.trends?.netProfitPct != null
                ? formatTrendPct(kpis.trends.netProfitPct)
                : undefined
            }
          />
          <KpiCard
            label="مشتریان جدید"
            value={formatCount(kpis.newCustomers)}
            trend={
              kpis.trends?.newCustomersPct != null
                ? formatTrendPct(kpis.trends.newCustomersPct)
                : undefined
            }
          />
          <KpiCard
            label="پروژه‌های تأخیری"
            value={formatCount(kpis.overdueProjects)}
          />
        </div>
        <div className="grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardContent className="pt-5">
              مطالبات:{" "}
              <span className="tabular-nums" dir="ltr">
                {formatMoneyEn(kpis.receivable)}
              </span>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-5">
              مشتریان متوقف‌شده در مسیر فروش:{" "}
              <span className="tabular-nums" dir="ltr">
                {formatCount(kpis.stuckInPipeline)}
              </span>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-5">
              پیام تماس این ماه:{" "}
              <span className="tabular-nums" dir="ltr">
                {formatCount(kpis.contactMessagesThisMonth)}
              </span>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-5">
              تیم:{" "}
              <span className="tabular-nums" dir="ltr">
                {formatCount(kpis.teamSize)}
              </span>{" "}
              نفر ·{" "}
              <span className="tabular-nums" dir="ltr">
                {formatCount(kpis.projectsPerPerson)}
              </span>{" "}
              پروژه/نفر
            </CardContent>
          </Card>
        </div>
      </section>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">نمای کلی کسب‌وکار</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm leading-relaxed text-muted-foreground">
            {withEnglishDigits(briefing.overview)}
          </p>
          <PerformanceChart kpis={kpis} />
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <BulletCard
          title="چه چیزی خوب پیش می‌رود"
          items={briefing.goingWell}
          tone="good"
        />
        <BulletCard
          title="نیازمند توجه"
          items={briefing.needsAttention}
          tone="warn"
        />
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <BulletCard title="نقاط قوت" items={briefing.strengths} tone="good" />
        <BulletCard title="نقاط ضعف" items={briefing.weaknesses} tone="warn" />
        <BulletCard title="فرصت‌های رشد" items={briefing.opportunities} />
      </div>

      <section className="space-y-3">
        <h2 className="text-base font-semibold">اقدامات پیشنهادی</h2>
        {briefing.recommendedActions?.length ? (
          <div className="space-y-3">
            {briefing.recommendedActions.map((action, i) => (
              <ActionItem key={i} action={action} />
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            در حال حاضر اقدام اولویت‌دار بر اساس داده موجود شناسایی نشد.
          </p>
        )}
      </section>
    </div>
  );
}

function WeeklyStrategyPanel({
  data,
}: {
  data: BusinessBriefingPayload;
}) {
  const weekly = data.briefing.weeklyStrategy;
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">خلاصه استراتژی هفته</CardTitle>
        </CardHeader>
        <CardContent>
          {weekly?.summary ? (
            <p className="text-sm leading-relaxed text-muted-foreground">
              {withEnglishDigits(weekly.summary)}
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">
              خلاصه هفته هنوز آماده نیست.
            </p>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        <BulletCard title="اولویت‌های هفته" items={weekly?.priorities} />
        <BulletCard
          title="مسائل نیازمند توجه"
          items={weekly?.problems}
          tone="warn"
        />
        <BulletCard title="فرصت‌های هفته" items={weekly?.opportunities} />
        <BulletCard title="بازاریابی" items={weekly?.marketing} />
        <BulletCard title="فروش" items={weekly?.sales} />
        <BulletCard title="مشتریان" items={weekly?.customers} />
        <BulletCard title="عملیات" items={weekly?.operations} />
        {weekly?.employees?.length ? (
          <BulletCard title="تیم و گردش کار" items={weekly.employees} />
        ) : null}
      </div>

      <section className="space-y-3">
        <h2 className="text-base font-semibold">اقدامات مشخص هفته</h2>
        {weekly?.tasks?.length ? (
          <div className="space-y-3">
            {weekly.tasks.map((action, i) => (
              <ActionItem key={i} action={action} />
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            اقدام مشخصی برای این هفته ثبت نشده است.
          </p>
        )}
      </section>
    </div>
  );
}

function MonthlyStrategyPanel({
  data,
}: {
  data: BusinessBriefingPayload;
}) {
  const monthly = data.briefing.monthlyStrategy;
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">نمای کلی ماه</CardTitle>
        </CardHeader>
        <CardContent>
          {monthly?.overview ? (
            <p className="text-sm leading-relaxed text-muted-foreground">
              {withEnglishDigits(monthly.overview)}
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">
              نمای ماهانه هنوز آماده نیست.
            </p>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-3 md:grid-cols-3">
        <div className="rounded-lg border p-3 text-sm">
          <p className="mb-1 font-medium">بازاریابی</p>
          <p className="text-muted-foreground">
            {withEnglishDigits(monthly?.marketingStrategy || "—")}
          </p>
        </div>
        <div className="rounded-lg border p-3 text-sm">
          <p className="mb-1 font-medium">فروش</p>
          <p className="text-muted-foreground">
            {withEnglishDigits(monthly?.salesStrategy || "—")}
          </p>
        </div>
        <div className="rounded-lg border p-3 text-sm">
          <p className="mb-1 font-medium">رشد مشتری</p>
          <p className="text-muted-foreground">
            {withEnglishDigits(monthly?.customerGrowthStrategy || "—")}
          </p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <BulletCard title="نقاط قوت" items={monthly?.strengths} tone="good" />
        <BulletCard title="نقاط ضعف" items={monthly?.weaknesses} tone="warn" />
        <BulletCard
          title="فرصت‌های رشد"
          items={monthly?.growthOpportunities}
        />
        <BulletCard title="اهداف ماه" items={monthly?.goals} />
        <BulletCard
          title="فرصت بهبود درآمد"
          items={monthly?.revenueOpportunities}
        />
        <BulletCard
          title="بهبود عملیاتی"
          items={monthly?.operationalImprovements}
        />
      </div>

      {monthly?.kpis?.length ? (
        <section className="space-y-3">
          <h2 className="text-base font-semibold">اهداف قابل اندازه‌گیری</h2>
          <div className="grid gap-3 sm:grid-cols-3">
            {monthly.kpis.map((item, i) => (
              <div key={i} className="rounded-lg border p-3 text-sm">
                <p className="font-medium">{withEnglishDigits(item.label)}</p>
                {item.target != null ? (
                  <p className="tabular-nums text-muted-foreground" dir="ltr">
                    هدف: {formatCount(Number(item.target))}
                  </p>
                ) : (
                  <p className="text-muted-foreground">
                    هدف پس از داده کافی قابل تعیین است
                  </p>
                )}
                {item.note ? (
                  <p className="mt-1 text-xs text-muted-foreground">
                    {withEnglishDigits(item.note)}
                  </p>
                ) : null}
              </div>
            ))}
          </div>
        </section>
      ) : null}

      <section className="space-y-3">
        <h2 className="text-base font-semibold">اقدامات ماهانه</h2>
        {monthly?.actions?.length ? (
          <div className="space-y-3">
            {monthly.actions.map((action, i) => (
              <ActionItem key={i} action={action} />
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            اقدام ماهانه مشخصی ثبت نشده است.
          </p>
        )}
      </section>
    </div>
  );
}

export default function BusinessAssistantPage() {
  const [tab, setTab] = useState("overview");
  const { data, isLoading, isFetching, refetch, isError } = useQuery({
    queryKey: ["business-assistant-briefing"],
    queryFn: () =>
      apiGet<BusinessBriefingPayload>("/business-assistant/briefing"),
    staleTime: 60_000,
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="مشاور کسب‌وکار"
        subtitle="تحلیل داده‌محور عملکرد، فرصت‌ها، و برنامه عملیاتی هفتگی و ماهانه"
        actions={
          <Button
            variant="outline"
            size="sm"
            disabled={isFetching}
            onClick={() => refetch()}
          >
            <RefreshCw
              className={`ms-1 h-4 w-4 ${isFetching ? "animate-spin" : ""}`}
            />
            به‌روزرسانی تحلیل
          </Button>
        }
      />

      {isLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-10 w-full max-w-md" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-48 w-full" />
        </div>
      ) : isError ? (
        <Card>
          <CardContent className="pt-6 text-sm text-destructive">
            بارگذاری تحلیل ناموفق بود. دوباره تلاش کنید.
          </CardContent>
        </Card>
      ) : data?.kpis && data.briefing ? (
        <>
          {data.insufficientData || data.briefing.dataNotes ? (
            <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 px-4 py-3 text-sm text-muted-foreground">
              {withEnglishDigits(
                data.briefing.dataNotes ||
                  "داده کافی برای برخی توصیه‌ها موجود نیست. ارقام موجود از سیستم آمده‌اند و موارد خالی حدس زده نشده‌اند.",
              )}
            </div>
          ) : null}

          <Tabs
            dir="rtl"
            value={tab}
            onValueChange={setTab}
            className="space-y-6"
          >
            <HorizontalScroll bordered={false}>
              <TabsList variant="line" className="min-w-max justify-start">
                <TabsTrigger value="overview" variant="line">
                  نمای کلی
                </TabsTrigger>
                <TabsTrigger value="weekly" variant="line">
                  استراتژی هفتگی
                </TabsTrigger>
                <TabsTrigger value="monthly" variant="line">
                  استراتژی ماهانه
                </TabsTrigger>
              </TabsList>
            </HorizontalScroll>

            <TabsContent value="overview" className="mt-0 outline-none">
              <OverviewPanel data={data} />
            </TabsContent>
            <TabsContent value="weekly" className="mt-0 outline-none">
              <WeeklyStrategyPanel data={data} />
            </TabsContent>
            <TabsContent value="monthly" className="mt-0 outline-none">
              <MonthlyStrategyPanel data={data} />
            </TabsContent>
          </Tabs>

          <p className="text-xs text-muted-foreground">
            {data.usedAi
              ? "تحلیل با داده‌های زنده سیستم تولید شد"
              : "تحلیل بر اساس قوانین داده سیستم تولید شد. برای روایت هوشمندتر، اتصال هوش مصنوعی را بررسی کنید."}
            {data.generatedAt
              ? ` · ${formatDateTimeEn(data.generatedAt)}`
              : ""}
          </p>
        </>
      ) : null}
    </div>
  );
}
