"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useChartTheme } from "@/hooks/use-chart-theme";
import type { BriefingKpis } from "./types";
import { formatMoneyEn } from "./display";

export function PerformanceChart({ kpis }: { kpis: BriefingKpis }) {
  const { brand, grid, axis } = useChartTheme();
  const data = [
    {
      name: "ماه قبل",
      درآمد: kpis.previousReceived || 0,
      سود: kpis.previousNetProfit || 0,
    },
    {
      name: "ماه جاری",
      درآمد: kpis.received || 0,
      سود: kpis.netProfit || 0,
    },
  ];

  return (
    <div className="h-[240px] w-full" dir="ltr">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} barGap={8}>
          <CartesianGrid stroke={grid} vertical={false} />
          <XAxis dataKey="name" tick={{ fill: axis, fontSize: 12 }} />
          <YAxis
            tick={{ fill: axis, fontSize: 11 }}
            tickFormatter={(v) =>
              Number(v).toLocaleString("en-US", { notation: "compact" })
            }
          />
          <Tooltip
            formatter={(value: number) => formatMoneyEn(Number(value || 0))}
            contentStyle={{
              borderRadius: 12,
              fontSize: 12,
              direction: "rtl",
            }}
          />
          <Bar dataKey="درآمد" fill={brand} radius={[6, 6, 0, 0]} />
          <Bar dataKey="سود" fill="#64748b" radius={[6, 6, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
