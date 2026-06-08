import type { LucideIcon } from "lucide-react";
import { ArrowDownRight, ArrowUpRight } from "lucide-react";

import type { DashboardStat } from "../../lib/mock-data";
import { cn } from "../../lib/utils";
import { Card } from "../ui/Card";

interface StatCardProps {
  stat: DashboardStat;
  icon: LucideIcon;
}

const toneClasses: Record<DashboardStat["tone"], string> = {
  primary: "bg-primary/10 text-primary",
  success: "bg-emerald-100 text-success",
  warning: "bg-amber-100 text-amber-700",
  danger: "bg-red-100 text-danger",
};

export function StatCard({ stat, icon: Icon }: StatCardProps) {
  const TrendIcon =
    stat.trendDirection === "up" ? ArrowUpRight : ArrowDownRight;

  return (
    <Card className="rounded-2xl">
      <div className="flex items-center gap-4 p-4">
        <div
          className={cn(
            "flex size-[52px] items-center justify-center rounded-full",
            toneClasses[stat.tone],
          )}
        >
          <Icon className="size-6" />
        </div>

        <div className="min-w-0 flex-1">
          <div className="text-xs font-medium text-slate-500">{stat.label}</div>
          <div className="mt-1 flex items-center gap-2">
            <div className="text-2xl font-semibold tracking-tight text-slate-950">
              {stat.value}
            </div>
            <div
              className={cn(
                "inline-flex items-center gap-1 text-xs font-semibold",
                stat.trendDirection === "up" ? "text-success" : "text-danger",
              )}
            >
              <TrendIcon className="size-3.5" />
              {stat.trend}
            </div>
          </div>
          <div className="mt-1 text-xs text-slate-500">{stat.comparison}</div>
        </div>
      </div>
    </Card>
  );
}
