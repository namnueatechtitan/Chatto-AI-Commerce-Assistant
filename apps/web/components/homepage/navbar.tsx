"use client";

/**
 * หน้าที่ไฟล์: ไฟล์นี้เก็บคอมโพเนนต์ส่วน navbar ของหน้า landing page
 */


import Link from "next/link";
import { Menu, X } from "lucide-react";
import { useState } from "react";

import { homepageNavItems } from "../../lib/homepage-data";
import { cn } from "../../lib/utils";
import { buttonVariants } from "../ui/Button";
import { Brand } from "./brand";
import { HomepageContainer } from "./container";

/**
 * หน้าที่: คอมโพเนนต์นี้เรนเดอร์แถบนำทาง ของหน้า
 */
export function Navbar() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 w-full pt-4">
      <HomepageContainer>
        <div className="w-full rounded-[28px] border border-white/70 bg-white/90 px-4 py-4 shadow-[0_16px_45px_rgba(15,23,42,0.08)] backdrop-blur sm:px-6">
          <div className="flex items-center justify-between gap-4">
            <Brand />

            <nav className="hidden items-center gap-10 lg:flex">
              {homepageNavItems.map((item) => (
                <Link
                  key={item.href}
                  className="text-sm font-medium text-slate-700 transition-colors hover:text-primary"
                  href={item.href}
                >
                  {item.label}
                </Link>
              ))}
            </nav>

            <div className="hidden items-center gap-3 lg:flex">
              <Link
                className={cn(
                  buttonVariants({ size: "default", variant: "outline" }),
                  "h-10 rounded-xl px-5",
                )}
                href="/login"
              >
                เข้าสู่ระบบ
              </Link>
              <Link
                className={cn(
                  buttonVariants({ size: "default", variant: "default" }),
                  "h-10 rounded-xl px-5",
                )}
                href="/register"
              >
                เริ่มต้นใช้งานฟรี
              </Link>
            </div>

            <button
              aria-expanded={isOpen}
              aria-label="Toggle navigation menu"
              className="flex size-11 items-center justify-center rounded-2xl border border-border bg-white text-slate-700 lg:hidden"
              onClick={() => setIsOpen((value) => !value)}
              type="button"
            >
              {isOpen ? <X className="size-5" /> : <Menu className="size-5" />}
            </button>
          </div>

          {isOpen ? (
            <div className="mt-4 border-t border-slate-100 pt-4 lg:hidden">
              <nav className="flex flex-col gap-2">
                {homepageNavItems.map((item) => (
                  <Link
                    key={item.href}
                    className="rounded-2xl px-4 py-3 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 hover:text-primary"
                    href={item.href}
                    onClick={() => setIsOpen(false)}
                  >
                    {item.label}
                  </Link>
                ))}
              </nav>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <Link
                  className={cn(
                    buttonVariants({ size: "default", variant: "outline" }),
                    "h-10 rounded-xl",
                  )}
                  href="/login"
                >
                  เข้าสู่ระบบ
                </Link>
                <Link
                  className={cn(
                    buttonVariants({ size: "default", variant: "default" }),
                    "h-10 rounded-xl",
                  )}
                  href="/register"
                >
                  เริ่มต้นใช้งานฟรี
                </Link>
              </div>
            </div>
          ) : null}
        </div>
      </HomepageContainer>
    </header>
  );
}
