/**
 * หน้าที่ไฟล์: ไฟล์นี้เก็บคอมโพเนนต์ส่วน top navbar ที่ใช้ประกอบหน้า dashboard
 */

import Link from "next/link";
import { Bell, ChevronDown, Menu } from "lucide-react";

import { dashboardOverview } from "../../lib/mock-data";

/**
 * หน้าที่: คอมโพเนนต์นี้เรนเดอร์แถบนำทาง Top
 */
export function TopNavbar() {
  return (
    <header className="sticky top-0 z-20 border-b border-border/80 bg-white/95 backdrop-blur">
      <div className="flex items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
        <Link
          aria-label="Go to dashboard overview"
          className="flex size-11 items-center justify-center rounded-2xl border border-border bg-slate-50 text-slate-700 transition-colors hover:bg-slate-100"
          href="/dashboard"
        >
          <Menu className="size-5" />
        </Link>

        <div className="flex items-center gap-3 sm:gap-4">
          <div className="hidden items-center gap-3 rounded-full bg-emerald-50 px-4 py-2 text-sm font-medium text-emerald-700 md:flex">
            <span className="size-2 rounded-full bg-success" />
            {dashboardOverview.aiStatus}
          </div>

          <button
            aria-label="Open notifications"
            className="relative flex size-10 items-center justify-center rounded-full border border-border bg-white text-slate-600 transition-colors hover:bg-slate-50"
            type="button"
          >
            <Bell className="size-5" />
            <span className="absolute -right-0.5 -top-1 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-danger px-1 text-[10px] font-semibold text-white">
              99+
            </span>
          </button>

          <div className="flex items-center gap-3 rounded-full border border-border bg-white px-2 py-1.5 shadow-soft">
            <div className="flex size-11 items-center justify-center rounded-full bg-gradient-to-br from-emerald-300 via-lime-300 to-emerald-500 text-sm font-semibold text-slate-900">
              PC
            </div>
            <div className="hidden min-w-0 sm:block">
              <div className="truncate text-sm font-semibold text-slate-950">
                {dashboardOverview.profileName}
              </div>
              <div className="text-xs text-slate-500">
                {dashboardOverview.profileRole}
              </div>
            </div>
            <ChevronDown className="size-4 text-slate-500" />
          </div>
        </div>
      </div>
    </header>
  );
}
