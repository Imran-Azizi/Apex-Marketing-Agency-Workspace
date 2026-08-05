"use client";

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatCurrency } from "@/lib/utils";
import { useChartTheme } from "@/hooks/use-chart-theme";
import { SectionShell } from "./widgets";
import type { ManagerMetrics } from "./types";

function ChartTooltip({
  active,
  payload,
  label,
  currency,
}: {
  active?: boolean;
  payload?: Array<{ name?: string; value?: number; color?: string }>;
  label?: string;
  currency?: boolean;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-border/80 bg-card px-3 py-2 text-xs shadow-lg">
      {label ? <p className="mb-1 font-medium text-foreground">{label}</p> : null}
      <ul className="space-y-0.5">
        {payload.map((p, i) => (
          <li key={i} className="flex items-center gap-2 text-muted-foreground">
            <span
              className="h-2 w-2 rounded-full"
              style={{ background: p.color }}
              aria-hidden
            />
            <span>{p.name}:</span>
            <span className="font-semibold text-foreground tabular-nums">
              {currency ? formatCurrency(Number(p.value || 0)) : p.value}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function BusinessCharts({ metrics }: { metrics: ManagerMetrics }) {
  const { palette, grid, axis, brand } = useChartTheme();
  const secondary = palette[1] ?? brand;

  return (
    <div className="grid gap-4 xl:grid-cols-2">
      <SectionShell
        title="پروژه‌ها بر اساس وضعیت"
        description="توزیع زنده وضعیت‌های گردش کار"
      >
        <div className="h-[280px] w-full" dir="ltr">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={metrics.statusChart}
                dataKey="count"
                nameKey="label"
                cx="50%"
                cy="50%"
                innerRadius={58}
                outerRadius={92}
                paddingAngle={2}
              >
                {metrics.statusChart.map((_, i) => (
                  <Cell key={i} fill={palette[i % palette.length]} />
                ))}
              </Pie>
              <Tooltip content={<ChartTooltip />} />
              <Legend
                verticalAlign="bottom"
                height={48}
                wrapperStyle={{ fontSize: 11, direction: "rtl", color: axis }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </SectionShell>

      <SectionShell
        title="رشد ماهانه پروژه‌ها"
        description="تعداد پروژه‌های ایجادشده در ۶ ماه اخیر"
      >
        <div className="h-[280px] w-full" dir="ltr">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={metrics.monthlyProjectGrowth}>
              <defs>
                <linearGradient id="projGrow" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={brand} stopOpacity={0.35} />
                  <stop offset="100%" stopColor={brand} stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid
                strokeDasharray="3 3"
                stroke={grid}
                vertical={false}
              />
              <XAxis
                dataKey="month"
                tick={{ fontSize: 11, fill: axis }}
                axisLine={{ stroke: grid }}
                tickLine={{ stroke: grid }}
              />
              <YAxis
                allowDecimals={false}
                tick={{ fontSize: 11, fill: axis }}
                axisLine={{ stroke: grid }}
                tickLine={{ stroke: grid }}
                width={32}
              />
              <Tooltip content={<ChartTooltip />} />
              <Area
                type="monotone"
                dataKey="count"
                name="پروژه"
                stroke={brand}
                fill="url(#projGrow)"
                strokeWidth={2}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </SectionShell>

      {metrics.finance?.available ? (
        <SectionShell
          title="درآمد ماهانه"
          description="مبلغ توافق‌شده و دریافتی بر اساس داده مالی پروژه‌ها"
          className="xl:col-span-2"
        >
          <div className="h-[280px] w-full" dir="ltr">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={metrics.monthlyRevenue}>
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke={grid}
                  vertical={false}
                />
                <XAxis
                  dataKey="month"
                  tick={{ fontSize: 11, fill: axis }}
                  axisLine={{ stroke: grid }}
                  tickLine={{ stroke: grid }}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: axis }}
                  axisLine={{ stroke: grid }}
                  tickLine={{ stroke: grid }}
                  width={48}
                />
                <Tooltip content={<ChartTooltip currency />} />
                <Legend
                  wrapperStyle={{ fontSize: 11, direction: "rtl", color: axis }}
                />
                <Bar
                  dataKey="revenue"
                  name="درآمد"
                  fill={brand}
                  radius={[6, 6, 0, 0]}
                />
                <Bar
                  dataKey="received"
                  name="دریافتی"
                  fill={secondary}
                  radius={[6, 6, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </SectionShell>
      ) : null}
    </div>
  );
}
