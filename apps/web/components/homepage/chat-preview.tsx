/**
 * หน้าที่ไฟล์: ไฟล์นี้เก็บคอมโพเนนต์ส่วน chat preview ของหน้า landing page
 */

import type { ReactNode } from "react";
import {
  Camera,
  CheckCheck,
  ChevronLeft,
  ImagePlus,
  Menu,
  Mic,
  Plus,
  Search,
  ShieldCheck,
  SmilePlus,
} from "lucide-react";

import { cn } from "../../lib/utils";

interface ChatPreviewProps {
  compact?: boolean;
  className?: string;
}

const avatarUrl =
  "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=96&q=80";

/**
 * หน้าที่: เรนเดอร์ avatar ของลูกค้าในตัวอย่างบทสนทนาบนหน้าแรก
 */
function CustomerAvatar({ compact = false }: { compact?: boolean }) {
  return (
    <img
      alt="Customer avatar"
      className={cn(
        "shrink-0 rounded-full object-cover ring-2 ring-white shadow-[0_8px_18px_rgba(15,23,42,0.10)]",
        compact ? "size-8" : "size-9",
      )}
      src={avatarUrl}
    />
  );
}

/**
 * หน้าที่: เรนเดอร์เวลาประกอบข้อความในตัวอย่างบทสนทนา
 */
function TimeStamp({
  time,
  delivered = false,
}: {
  time: string;
  delivered?: boolean;
}) {
  return (
    <div className="flex items-center gap-1 pb-1 text-[10px] text-slate-400">
      <span>{time}</span>
      {delivered ? <CheckCheck className="size-3 text-emerald-400" /> : null}
    </div>
  );
}

/**
 * หน้าที่: เรนเดอร์ bubble ของข้อความแต่ละก้อนในตัวอย่างบทสนทนา
 */
function MessageBubble({
  compact = false,
  outgoing = false,
  children,
}: {
  compact?: boolean;
  outgoing?: boolean;
  children: ReactNode;
}) {
  return (
    <div
      className={cn(
        "rounded-[18px] border text-slate-700 shadow-[0_8px_20px_rgba(15,23,42,0.05)]",
        outgoing
          ? "rounded-tr-md border-lime-100 bg-[linear-gradient(180deg,#EEFFD8_0%,#DDF7A9_100%)]"
          : "rounded-tl-md border-slate-100 bg-white",
        compact ? "px-3 py-2 text-[11px]" : "px-3.5 py-2.5 text-[12px]",
      )}
    >
      {children}
    </div>
  );
}

/**
 * หน้าที่: คอมโพเนนต์นี้เรนเดอร์ส่วน Chat Preview ตามข้อมูลที่รับเข้ามา
 */
export function ChatPreview({ compact = false, className }: ChatPreviewProps) {
  return (
    <div
      className={cn(
        "overflow-hidden rounded-[36px] border border-white/90 bg-white shadow-[0_18px_50px_rgba(15,23,42,0.10)] ring-1 ring-emerald-100/60",
        compact ? "w-[230px]" : "w-[320px]",
        className,
      )}
    >
      <div className={cn("bg-white", compact ? "px-4 py-3" : "px-4 py-3.5")}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <button
              aria-label="Back"
              className="flex size-7 items-center justify-center rounded-full text-slate-600"
              type="button"
            >
              <ChevronLeft className="size-4.5" />
            </button>

            <div className="flex size-8 items-center justify-center rounded-full bg-emerald-50 text-success">
              <ShieldCheck className="size-4.5" />
            </div>

            <div>
              <div className={cn("font-semibold text-slate-950", compact ? "text-xs" : "text-sm")}>
                Chatto
              </div>
              <div className="text-[10px] text-slate-500">AI Commerce Assistant</div>
            </div>
          </div>

          <div className="flex items-center gap-2 text-slate-600">
            <Search className="size-4" />
            <Menu className="size-4" />
          </div>
        </div>
      </div>

      <div
        className={cn(
          "relative space-y-4 border-t border-slate-100 bg-[linear-gradient(180deg,#FFFFFF_0%,#F8FAFC_100%)]",
          compact ? "min-h-[310px] px-4 py-3.5" : "min-h-[378px] px-4 py-3.5",
        )}
      >
        <div className="flex justify-center">
          <div className="rounded-full bg-slate-100 px-3 py-1 text-[10px] font-medium text-slate-500">
            วันนี้
          </div>
        </div>

        <div className="flex items-start gap-2.5">
          <CustomerAvatar compact={compact} />
          <div className="flex max-w-[78%] items-end gap-1.5">
            <MessageBubble compact={compact}>สินค้าตัวนี้มีอะไรบ้างคะ?</MessageBubble>
            <TimeStamp time="10:30" />
          </div>
        </div>

        <div className="flex justify-end">
          <div className="flex max-w-[82%] items-end gap-1.5">
            <MessageBubble compact={compact} outgoing>
              <div className="font-semibold">มี 4 สีให้เลือกครับ 😊</div>
              <div
                className={cn(
                  "mt-2 grid grid-cols-2 gap-x-5 gap-y-1.5",
                  compact ? "text-[10px]" : "text-[11px]",
                )}
              >
                <div>• ดำ</div>
                <div>• ขาว</div>
                <div>• น้ำเงิน</div>
                <div>• เขียว</div>
              </div>
            </MessageBubble>
            <TimeStamp delivered time="10:30" />
          </div>
        </div>

        <div className="flex items-start gap-2.5">
          <CustomerAvatar compact={compact} />
          <div className="flex max-w-[72%] items-end gap-1.5">
            <MessageBubble compact={compact}>ราคาเท่าไหร่คะ?</MessageBubble>
            <TimeStamp time="10:31" />
          </div>
        </div>

        <div className="flex justify-end">
          <div className="flex max-w-[82%] items-end gap-1.5">
            <MessageBubble compact={compact} outgoing>
              <div>ราคา 590 บาทครับ</div>
              <div className="mt-1">พร้อมส่งทันที 🚚</div>
            </MessageBubble>
            <TimeStamp delivered time="10:31" />
          </div>
        </div>
      </div>

      <div className={cn("border-t border-slate-100 bg-white", compact ? "px-4 py-3" : "px-4 py-3")}>
        <div className="flex items-center gap-2.5 text-slate-500">
          <Plus className="size-4.5" />
          <Camera className="size-4.5" />
          <ImagePlus className="size-4.5" />
          <div
            className={cn(
              "flex-1 rounded-full border border-slate-100 bg-slate-50 text-slate-400",
              compact ? "px-3 py-2 text-[11px]" : "px-3 py-2.5 text-xs",
            )}
          >
            พิมพ์ข้อความ...
          </div>
          <SmilePlus className="size-4.5" />
          <Mic className="size-4.5" />
        </div>
      </div>
    </div>
  );
}
