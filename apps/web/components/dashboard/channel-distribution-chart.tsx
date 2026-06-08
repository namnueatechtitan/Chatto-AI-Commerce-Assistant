"use client";

import {
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import type { TooltipProps } from "recharts";

import type { ChannelDistributionItem } from "../../lib/mock-data";
import { cn } from "../../lib/utils";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "../ui/Card";

interface ChannelDistributionChartProps {
  data: ChannelDistributionItem[];
  totalMessages: string;
  className?: string;
}

function ChannelTooltip({
  active,
  payload,
}: TooltipProps<number, string>) {
  if (!active || !payload?.length) {
    return null;
  }

  const item = payload[0];

  return (
    <div className="rounded-2xl border border-border bg-white px-4 py-3 shadow-soft">
      <div className="text-sm font-semibold text-slate-950">{item.name}</div>
      <div className="mt-1 text-sm text-slate-500">{item.value} ข้อความ</div>
    </div>
  );
}

export function ChannelDistributionChart({
  data,
  totalMessages,
  className,
}: ChannelDistributionChartProps) {
  const totalValue = data.reduce((sum, item) => sum + item.value, 0);

  return (
    <Card className={cn("h-full rounded-3xl", className)}>
      <CardHeader className="pb-2">
        <CardTitle>ช่องทางการแชท</CardTitle>
      </CardHeader>

      <CardContent className="pt-3">
        <div className="grid gap-6 xl:grid-cols-[124px_minmax(0,1fr)] xl:items-center">
          <div className="relative mx-auto h-[124px] w-[124px]">
            <ResponsiveContainer height="100%" width="100%">
              <PieChart>
                <Pie
                  data={data}
                  dataKey="value"
                  innerRadius={40}
                  outerRadius={58}
                  paddingAngle={3}
                  stroke="transparent"
                >
                  {data.map((item) => (
                    <Cell key={item.name} fill={item.color} />
                  ))}
                </Pie>
                <Tooltip content={<ChannelTooltip />} />
              </PieChart>
            </ResponsiveContainer>

            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
              <div className="text-xl font-semibold text-slate-950">
                {totalMessages}
              </div>
              <div className="text-[11px] text-slate-500">ข้อความทั้งหมด</div>
            </div>
          </div>

          <div className="space-y-4">
            {data.map((item) => {
              const percentage = Math.round((item.value / totalValue) * 100);

              return (
                <div
                  key={item.name}
                  className="flex items-start justify-between gap-3 text-sm"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className={cn("size-2 rounded-full", item.dotClassName)} />
                      <span className="font-medium text-slate-900">
                        {item.name}
                      </span>
                    </div>
                    <div className="mt-1 text-xs text-slate-400">
                      {item.followers}
                    </div>
                  </div>
                  <div className="text-right text-xs text-slate-500">
                    <div className="font-semibold text-slate-900">
                      {percentage}% ({item.value.toLocaleString("en-US")})
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
