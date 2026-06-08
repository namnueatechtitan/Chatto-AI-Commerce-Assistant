import {
  AlertTriangle,
  BookOpenText,
  BrainCircuit,
  HardDrive,
  Sparkles,
} from "lucide-react";

import type {
  AssistantHighlight,
  AssistantWidget,
} from "../../lib/mock-data";
import { Badge } from "../ui/Badge";
import { Button } from "../ui/Button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "../ui/Card";
import { Progress } from "../ui/Progress";

interface AIAssistantPanelProps {
  highlights: AssistantHighlight[];
  widgets: AssistantWidget[];
  className?: string;
}

export function AIAssistantPanel({
  highlights,
  widgets,
  className,
}: AIAssistantPanelProps) {
  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <div className="flex size-10 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <BrainCircuit className="size-5" />
          </div>
          <div>
            <CardTitle>AI Assistant</CardTitle>
            <div className="mt-1 text-sm text-slate-500">
              ตัวช่วยติดตามสถานะ AI และข้อมูลของร้านแบบเรียลไทม์
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-5 pt-1">
        <div className="rounded-2xl bg-emerald-50 p-4">
          <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-emerald-700">
            <Sparkles className="size-4" />
            คำแนะนำของ Chatto วันนี้
          </div>
          <div className="space-y-3">
            {highlights.map((highlight) => (
              <div key={highlight.title} className="space-y-1">
                <div className="text-sm font-medium text-slate-900">
                  {highlight.title}
                </div>
                <div className="text-xs leading-5 text-slate-500">
                  {highlight.description}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-3">
          {widgets.map((widget) => {
            const isStorage = widget.title === "พื้นที่ใช้งาน";
            const isModel = widget.title === "AI Model Status";
            const isKnowledge = widget.title === "Knowledge Base";
            const icon = isStorage ? (
              <HardDrive className="size-4" />
            ) : isKnowledge ? (
              <BookOpenText className="size-4" />
            ) : (
              <AlertTriangle className="size-4" />
            );

            return (
              <div key={widget.title} className="rounded-2xl border border-border p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 items-start gap-3">
                    <div className="mt-0.5 flex size-9 items-center justify-center rounded-xl bg-slate-100 text-slate-600">
                      {icon}
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs font-medium text-slate-500">
                        {widget.title}
                      </div>
                      <div className="mt-1 text-sm font-semibold text-slate-950">
                        {widget.value}
                      </div>
                      <div className="mt-1 text-xs text-slate-500">
                        {widget.meta}
                      </div>
                    </div>
                  </div>
                  <Badge variant={widget.variant}>
                    {isModel ? "พร้อม" : "อัปเดต"}
                  </Badge>
                </div>

                {isStorage ? (
                  <div className="mt-3 space-y-3">
                    <Progress value={68} />
                    <Button className="w-full" size="sm" variant="outline">
                      {widget.action}
                    </Button>
                  </div>
                ) : (
                  <Button className="mt-3 w-full" size="sm" variant="outline">
                    {widget.action}
                  </Button>
                )}
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
