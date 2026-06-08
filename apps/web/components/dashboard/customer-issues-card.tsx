import type {
  CustomerIssueCategory,
  CustomerIssueMetric,
} from "../../lib/mock-data";
import { cn } from "../../lib/utils";
import { Button } from "../ui/Button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "../ui/Card";

interface CustomerIssuesCardProps {
  metrics: CustomerIssueMetric[];
  categories: CustomerIssueCategory[];
  className?: string;
}

const metricToneClasses: Record<CustomerIssueMetric["tone"], string> = {
  default: "bg-slate-50 text-slate-900",
  danger: "bg-red-50 text-red-700",
  info: "bg-blue-50 text-blue-700",
  success: "bg-emerald-50 text-emerald-700",
};

export function CustomerIssuesCard({
  metrics,
  categories,
  className,
}: CustomerIssuesCardProps) {
  return (
    <Card className={className}>
      <CardHeader className="flex flex-row items-start justify-between gap-4 pb-3">
        <CardTitle>สรุปปัญหาลูกค้า</CardTitle>
        <Button className="h-8 rounded-full px-3 text-xs" size="sm" variant="destructive">
          + แจ้งปัญหาใหม่
        </Button>
      </CardHeader>

      <CardContent className="space-y-6 pt-2">
        <div className="grid grid-cols-2 gap-3">
          {metrics.map((metric) => (
            <div
              key={metric.label}
              className={cn(
                "rounded-2xl p-4",
                metricToneClasses[metric.tone],
              )}
            >
              <div className="text-xs text-slate-500">{metric.label}</div>
              <div className="mt-3 text-2xl font-semibold text-current">
                {metric.value}
              </div>
            </div>
          ))}
        </div>

        <div>
          <div className="mb-4 text-sm font-semibold text-slate-900">
            ประเภทปัญหาที่พบบ่อย
          </div>
          <div className="space-y-3">
            {categories.map((category) => (
              <div
                key={category.label}
                className="flex items-center justify-between gap-3 text-sm"
              >
                <div className="flex items-center gap-2 text-slate-600">
                  <span
                    className={cn("size-2 rounded-full", category.colorClassName)}
                  />
                  {category.label}
                </div>
                <div className="font-semibold text-slate-900">
                  {category.count}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="text-right text-xs font-semibold text-success">
          ดูรายงานปัญหาทั้งหมด →
        </div>
      </CardContent>
    </Card>
  );
}
