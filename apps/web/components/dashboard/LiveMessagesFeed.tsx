"use client";

import {
  Activity,
  ChevronRight,
  RefreshCw,
  Webhook,
} from "lucide-react";

import { useLatestMessages } from "../../hooks/useLatestMessages";
import { cn } from "../../lib/utils";
import { Badge } from "../ui/Badge";
import { Button } from "../ui/Button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../ui/Card";
import { LiveMessagesEmpty } from "./LiveMessagesEmpty";
import { LiveMessagesError } from "./LiveMessagesError";
import { LiveMessagesSkeleton } from "./LiveMessagesSkeleton";

interface LiveMessagesFeedProps {
  className?: string;
}

function getAvatarFallback(name: string) {
  return name.trim().charAt(0).toUpperCase();
}

function formatTimestamp(timestamp: string) {
  const date = new Date(timestamp);

  if (Number.isNaN(date.getTime())) {
    return timestamp;
  }

  return date.toLocaleTimeString("th-TH", {
    hour: "2-digit",
    hour12: false,
    minute: "2-digit",
    second: "2-digit",
  });
}

export function LiveMessagesFeed({ className }: LiveMessagesFeedProps) {
  const { error, isLoading, messages, refresh } = useLatestMessages();

  return (
    <Card className={cn("w-full", className)}>
      <CardHeader className="gap-4 border-b border-slate-100 pb-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <CardTitle>ข้อความล่าสุด</CardTitle>
            <CardDescription className="mt-1">
              Live Messages Feed
            </CardDescription>
            <div className="mt-2 text-xs font-semibold text-emerald-700">
              รับข้อความจาก LINE OA แบบเรียลไทม์
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Badge
              className="gap-2 border-emerald-200 bg-emerald-50 px-3 py-1.5 text-emerald-700"
              variant="success"
            >
              <span className="size-2 rounded-full bg-[#22C55E]" />
              Live
            </Badge>
            <Button
              className="rounded-full px-3"
              size="sm"
              type="button"
              variant="outline"
              onClick={refresh}
            >
              <RefreshCw className="size-4" />
              Refresh
            </Button>
            <Button className="rounded-full px-4" size="sm" type="button" variant="outline">
              View All
            </Button>
          </div>
        </div>

        <div className="rounded-[28px] border border-emerald-100 bg-emerald-50 px-4 py-4">
          <div className="flex items-start gap-3">
            <div className="flex size-11 items-center justify-center rounded-2xl bg-white text-emerald-600 shadow-sm">
              <Webhook className="size-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-sm font-semibold text-emerald-900">
                <Activity className="size-4" />
                LINE OA Integration Active
              </div>
              <div className="mt-1 text-xs font-medium text-emerald-700">
                Webhook Connected • Messages Stored Successfully
              </div>
              <div className="mt-1 text-xs text-emerald-700/90">
                LINE OA → Webhook → Backend → Database → Dashboard
              </div>
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent className="pt-5">
        {isLoading ? (
          <LiveMessagesSkeleton />
        ) : error ? (
          <LiveMessagesError onRetry={refresh} />
        ) : messages.length === 0 ? (
          <LiveMessagesEmpty />
        ) : (
          <div className="divide-y divide-slate-100">
            {messages.map((message) => (
              <button
                key={message.id}
                className="flex w-full cursor-pointer items-center gap-4 rounded-[24px] px-3 py-4 text-left transition-colors duration-200 hover:bg-emerald-50/80"
                type="button"
              >
                <div className="flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-emerald-100 text-sm font-semibold text-emerald-700">
                  {message.customerAvatar ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      alt={message.customerName}
                      className="h-full w-full object-cover"
                      src={message.customerAvatar}
                    />
                  ) : (
                    getAvatarFallback(message.customerName)
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex min-w-0 items-center gap-2">
                      <div className="truncate text-sm font-semibold text-slate-950">
                        {message.customerName}
                      </div>
                      <Badge
                        className="shrink-0 border-emerald-200 text-emerald-700"
                        variant="outline"
                      >
                        {message.channel}
                      </Badge>
                    </div>

                    <div className="flex items-center gap-2 text-xs text-slate-500">
                      {message.unread ? (
                        <span className="size-2 rounded-full bg-[#22C55E]" />
                      ) : null}
                      <span>{formatTimestamp(message.timestamp)}</span>
                    </div>
                  </div>

                  <div className="mt-2 flex items-center gap-3">
                    <p className="min-w-0 flex-1 truncate text-sm text-slate-600">
                      {message.message}
                    </p>
                    {message.unread ? (
                      <span className="shrink-0 text-xs font-semibold text-emerald-600">
                        ใหม่
                      </span>
                    ) : null}
                    <ChevronRight className="size-4 shrink-0 text-slate-300" />
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
