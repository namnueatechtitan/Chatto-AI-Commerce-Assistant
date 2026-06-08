import { ChevronDown } from "lucide-react";

import type { PerformanceMetric } from "../../lib/mock-data";
import { cn } from "../../lib/utils";
import { Button } from "../ui/Button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "../ui/Card";

interface AIPerformanceCardProps {
  metrics: PerformanceMetric[];
  periodLabel: string;
  className?: string;
}

export function AIPerformanceCard({
  metrics,
  periodLabel,
  className,
}: AIPerformanceCardProps) {
  return (
    <Card className={className}>
      <CardHeader className="flex flex-row items-start justify-between gap-4 pb-3">
        <CardTitle>AI Performance</CardTitle>
        <Button className="rounded-lg px-3 text-xs" size="sm" variant="outline">
          {periodLabel}
          <ChevronDown className="size-3.5" />
        </Button>
      </CardHeader>

      <CardContent className="pt-1">
        <div className="divide-y divide-slate-100">
          {metrics.map((metric) => (
            <div
              key={metric.label}
              className="flex items-center justify-between gap-4 py-4 first:pt-0 last:pb-0"
            >
              <div className="text-sm text-slate-600">{metric.label}</div>
              <div className="text-right">
                <div className="text-sm font-semibold text-slate-950">
                  {metric.value}
                </div>
                <div
                  className={cn(
                    "text-xs font-semibold",
                    metric.direction === "up" ? "text-success" : "text-danger",
                  )}
                >
                  {metric.change}
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-6 text-right text-xs font-semibold text-success">
          ดูรายละเอียด AI Performance →
        </div>
      </CardContent>
    </Card>
  );
}
