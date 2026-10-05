"use client";

import { ChevronDown } from "lucide-react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
} from "recharts";
import type { TooltipProps } from "recharts";

import type { MessageOverviewPoint } from "../../lib/mock-data";
import { cn } from "../../lib/utils";
import { Button } from "../ui/Button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "../ui/Card";

interface MessageOverviewChartProps {
  data: MessageOverviewPoint[];
  periodLabel: string;
  className?: string;
}

function MessageOverviewTooltip({
  active,
  payload,
  label,
}: TooltipProps<number, string>) {
  if (!active || !payload?.length) {
    return null;
  }

  return (
    <div className="rounded-2xl border border-border bg-white px-4 py-3 shadow-soft">
      <div className="text-xs font-semibold text-slate-500">{label}</div>
      <div className="mt-2 space-y-1.5">
        {payload.map((entry) => (
          <div
            key={entry.dataKey}
            className="flex items-center justify-between gap-4 text-sm"
          >
            <div className="flex items-center gap-2 text-slate-600">
              <span
                className={cn(
                  "size-2 rounded-full",
                  entry.dataKey === "total" ? "bg-primary" : "bg-slate-300",
                )}
              />
              {entry.name}
            </div>
            <span className="font-semibold text-slate-950">{entry.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function MessageOverviewChart({
  data,
  periodLabel,
  className,
}: MessageOverviewChartProps) {
  return (
    <Card className={cn("h-full rounded-3xl", className)}>
      <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-4 pb-2">
        <div className="space-y-3">
          <CardTitle>ภาพรวมข้อความ</CardTitle>
          <div className="flex flex-wrap items-center gap-5 text-xs text-slate-500">
            <div className="flex items-center gap-2">
              <span className="h-[0.3125rem] w-4 rounded-full bg-primary" />
              ข้อความทั้งหมด
            </div>
            <div className="flex items-center gap-2">
              <span className="h-[0.3125rem] w-4 rounded-full bg-slate-300" />
              ข้อความที่ AI ตอบ
            </div>
          </div>
        </div>

        <Button className="rounded-lg px-3 text-xs" size="sm" variant="outline">
          {periodLabel}
          <ChevronDown className="size-3.5" />
        </Button>
      </CardHeader>

      <CardContent className="pt-1">
        <div className="h-[13.125rem]">
          <ResponsiveContainer height="100%" width="100%">
            <LineChart data={data}>
              <CartesianGrid stroke="#EEF2F7" vertical={false} />
              <XAxis
                axisLine={false}
                dataKey="label"
                tick={{ fill: "#94A3B8", fontSize: "0.75rem" }}
                tickLine={false}
              />
              <Tooltip content={<MessageOverviewTooltip />} />
              <Line
                dataKey="total"
                dot={false}
                name="ข้อความทั้งหมด"
                stroke="#22C55E"
                strokeWidth="0.1875rem"
                type="monotone"
              />
              <Line
                dataKey="ai"
                dot={false}
                name="ข้อความที่ AI ตอบ"
                stroke="#CBD5E1"
                strokeDasharray="0.375rem 0.375rem"
                strokeWidth="0.125rem"
                type="monotone"
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
