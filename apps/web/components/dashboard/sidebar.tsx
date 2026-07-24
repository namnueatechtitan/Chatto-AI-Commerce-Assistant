"use client";

/**
 * หน้าที่ไฟล์: ไฟล์นี้เก็บคอมโพเนนต์ส่วน sidebar ที่ใช้ประกอบหน้า dashboard
 */


import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BookOpenText,
  Bot,
  Handshake,
  LayoutDashboard,
  MessageSquareText,
  Package,
  Settings,
  Sparkles,
} from "lucide-react";

import { cn } from "../../lib/utils";
import { Badge } from "../ui/Badge";

interface SidebarProps {
  mobile?: boolean;
  className?: string;
}

const navigationItems = [
  { href: "/dashboard", label: "ภาพรวม", icon: LayoutDashboard },
  { href: "/dashboard/products", label: "สินค้า", icon: Package },
  { href: "/dashboard/faq", label: "FAQ / Knowledge", icon: BookOpenText },
  { href: "/dashboard/conversations", label: "Conversations", icon: MessageSquareText },
  { href: "/dashboard/handover", label: "Handover", icon: Handshake },
  { href: "/dashboard/settings", label: "Settings", icon: Settings },
];

/**
 * หน้าที่: คอมโพเนนต์นี้เรนเดอร์ sidebar ของส่วน นี้
 */
export function Sidebar({ mobile = false, className }: SidebarProps) {
  const pathname = usePathname();

  if (mobile) {
    return (
      <nav
        aria-label="Dashboard navigation"
        className={cn("flex gap-2 overflow-x-auto pb-1", className)}
      >
        {navigationItems.map((item) => {
          const isActive =
            pathname === item.href ||
            (item.href !== "/dashboard" && pathname.startsWith(item.href));
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "inline-flex items-center gap-2 rounded-full border border-border bg-white px-4 py-2 text-sm font-medium whitespace-nowrap text-slate-600 transition-colors hover:border-primary/30 hover:text-slate-950",
                isActive && "border-primary/20 bg-primary/10 text-primary",
              )}
            >
              <Icon className="size-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>
    );
  }

  return (
    <aside
      className={cn(
        "hidden h-screen flex-col border-r border-border bg-[#f7faf7] px-5 py-6 xl:flex",
        className,
      )}
    >
      <div className="sidebar-brand gap-4">
        <div className="flex items-center gap-3">
          <div className="flex size-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <Bot className="size-6" />
          </div>
          <div className="space-y-1">
            <div className="sidebar-brand-title">Chatto</div>
            <div className="sidebar-brand-subtitle">
              AI Commerce Assistant
            </div>
          </div>
        </div>
        <Badge variant="success" className="w-fit">
          Phase 2 Merchant Dashboard
        </Badge>
      </div>

      <nav className="sidebar-nav mt-8" aria-label="Dashboard navigation">
        {navigationItems.map((item) => {
          const isActive =
            pathname === item.href ||
            (item.href !== "/dashboard" && pathname.startsWith(item.href));
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn("sidebar-link flex items-center gap-3", isActive && "sidebar-link-active")}
            >
              <Icon className="size-4" />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto rounded-[28px] bg-[#06281A] p-5 text-white shadow-card">
        <div className="mb-3 flex items-center gap-2 text-sm font-medium text-emerald-200">
          <Sparkles className="size-4" />
          Chatto AI Tips
        </div>
        <p className="text-lg font-semibold leading-8">
          ใช้ข้อมูลสินค้าและ FAQ ให้ครบ เพื่อให้ AI ตอบแม่นขึ้นในทุกช่องทาง
        </p>
        <p className="mt-3 text-sm leading-6 text-emerald-50/80">
          ทีมแอดมินจะเห็นเคสที่ควรติดตามได้เร็วขึ้น และลดการตอบซ้ำในช่วงพีคของร้าน
        </p>
      </div>
    </aside>
  );
}
