import { AlertCircle } from "lucide-react";
import Link from "next/link";

import { Button } from "../ui/Button";

interface LiveMessagesErrorProps {
  onRetry: () => void;
  message?: string;
  requiresLogin?: boolean;
}

export function LiveMessagesError({ onRetry, message = "กรุณาลองใหม่อีกครั้ง", requiresLogin = false }: LiveMessagesErrorProps) {
  return (
    <div className="flex flex-col items-center justify-center rounded-[1.75rem] border border-red-100 bg-red-50/80 px-6 py-12 text-center">
      <div className="flex size-14 items-center justify-center rounded-2xl bg-white text-red-500 shadow-sm">
        <AlertCircle className="size-6" />
      </div>
      <div className="mt-4 text-base font-semibold text-slate-950">
        ไม่สามารถโหลดข้อความได้
      </div>
      <p className="mt-2 text-sm leading-6 text-slate-500">
        {message}
      </p>
      {requiresLogin ? <Link className="mt-5 rounded-full border border-border bg-white px-5 py-2 text-sm" href="/login">เข้าสู่ระบบอีกครั้ง</Link> : <Button
        className="mt-5 rounded-full px-5"
        size="sm"
        type="button"
        variant="outline"
        onClick={onRetry}
      >
        ลองใหม่
      </Button>}
    </div>
  );
}
