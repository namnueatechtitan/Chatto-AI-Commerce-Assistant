"use client";

import {
  Activity,
  ChevronRight,
  RefreshCw,
  Webhook,
} from "lucide-react";
import { useState } from "react";
import { useRouter } from "next/navigation";

import { useLatestMessages } from "../../hooks/useLatestMessages";
import type { Merchant } from "../../lib/merchants";
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
  merchants: Merchant[];
  selectedMerchantId: string | null;
  invalidSelection?: boolean;
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

export function LiveMessagesFeed({ className, merchants, selectedMerchantId, invalidSelection = false }: LiveMessagesFeedProps) {
  const router = useRouter();
  const [merchantId, setMerchantId] = useState(selectedMerchantId);
  const [selectionError, setSelectionError] = useState(invalidSelection);
  const { error, requiresLogin, isLoading, messages, refresh } = useLatestMessages(merchantId);

  function selectMerchant(id: string) {
    const authorizedId = merchants.some((merchant) => merchant.id === id) ? id : null;
    // Change the query scope immediately, before the server navigation finishes.
    setMerchantId(authorizedId);
    setSelectionError(false);
    const url = new URL(window.location.href);
    if (authorizedId) url.searchParams.set("merchantId", authorizedId);
    else url.searchParams.delete("merchantId");
    router.replace(`${url.pathname}${url.search}`, { scroll: false });
  }

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
              disabled={!merchantId || requiresLogin}
            >
              <RefreshCw className="size-4" />
              Refresh
            </Button>
            <Button className="rounded-full px-4" size="sm" type="button" variant="outline">
              View All
            </Button>
          </div>
        </div>

        <div className="space-y-2">
          <label className="block text-sm font-medium text-slate-700" htmlFor="messages-merchant">ร้านค้าที่ต้องการดูข้อความ</label>
          <select id="messages-merchant" className="w-full rounded-xl border border-border bg-white px-3 py-2 text-sm" value={merchantId ?? ""} onChange={(event) => selectMerchant(event.target.value)}>
            <option value="">เลือกร้านค้า</option>
            {merchants.map((merchant) => <option key={merchant.id} value={merchant.id}>{merchant.shopName}</option>)}
          </select>
        </div>

        <div className="rounded-[1.75rem] border border-emerald-100 bg-emerald-50 px-4 py-4">
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
        {!merchantId ? (
          <p role="status" className="py-8 text-center text-sm text-slate-600">{selectionError ? "ไม่พบร้านค้าหรือคุณไม่มีสิทธิ์ดูข้อความของร้านนี้ กรุณาเลือกร้านค้า" : "เลือกร้านค้าก่อนดูข้อความล่าสุด"}</p>
        ) : isLoading ? (
          <LiveMessagesSkeleton />
        ) : error ? (
          <LiveMessagesError onRetry={refresh} message={error} requiresLogin={requiresLogin} />
        ) : messages.length === 0 ? (
          <LiveMessagesEmpty />
        ) : (
          <div className="divide-y divide-slate-100">
            {messages.map((message) => (
              <button
                key={message.id}
                className="flex w-full cursor-pointer items-center gap-4 rounded-[1.5rem] px-3 py-4 text-left transition-colors duration-200 hover:bg-emerald-50/80"
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
