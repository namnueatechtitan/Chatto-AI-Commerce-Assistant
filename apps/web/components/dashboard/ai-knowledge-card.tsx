import type { ProgressMetric } from "../../lib/mock-data";
import { Button } from "../ui/Button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "../ui/Card";
import { Progress } from "../ui/Progress";

interface AIKnowledgeCardProps {
  metrics: ProgressMetric[];
  className?: string;
}

export function AIKnowledgeCard({
  metrics,
  className,
}: AIKnowledgeCardProps) {
  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <CardTitle>AI Knowledge</CardTitle>
      </CardHeader>
      <CardContent className="space-y-5 pt-1">
        {metrics.map((metric) => (
          <div key={metric.label} className="space-y-2.5">
            <div className="flex items-center justify-between gap-3 text-sm">
              <span className="text-slate-600">{metric.label}</span>
              <span className="font-semibold text-success">{metric.value}%</span>
            </div>
            <Progress value={metric.value} />
          </div>
        ))}

        <Button className="w-full" variant="outline">
          Upload More Data
        </Button>
      </CardContent>
    </Card>
  );
}
