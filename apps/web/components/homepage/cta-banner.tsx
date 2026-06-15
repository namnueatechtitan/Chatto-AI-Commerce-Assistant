import Link from "next/link";
import { ArrowRight, Play, ShoppingCart, TrendingUp } from "lucide-react";

import { homepageAssets } from "../../lib/homepage-data";
import { cn } from "../../lib/utils";
import { buttonVariants } from "../ui/Button";
import { ChatPreview } from "./chat-preview";
import { HomepageContainer } from "./container";

export function CtaBanner() {
  return (
    <section className="py-16 lg:py-20">
      <HomepageContainer>
        <div className="relative overflow-hidden rounded-[30px] bg-[#06281A] px-6 py-8 shadow-[0_24px_55px_rgba(6,40,26,0.24)] sm:px-8 lg:px-10">
          <div className="absolute left-20 top-8 h-10 w-10 text-lime-300">✦</div>
          <div className="absolute left-[24%] top-24 h-8 w-8 text-lime-300">✦</div>
          <div className="absolute right-10 top-8 h-24 w-24 rounded-full bg-success/10 blur-2xl" />

          <div className="grid gap-8 lg:grid-cols-[320px_minmax(0,1fr)_280px] lg:items-center">
            <div className="relative">
              <img
                alt="CTA Greendy mascot"
                className="h-auto w-full max-w-[300px]"
                src={homepageAssets.ctaMascot}
              />
            </div>

            <div className="text-white">
              <h2 className="max-w-[420px] text-[2rem] font-bold leading-tight tracking-[-0.04em] sm:text-[2.4rem]">
                พร้อมให้ AI ช่วยตอบลูกค้าแทนคุณแล้วหรือยัง ?
              </h2>
              <p className="mt-4 max-w-[430px] text-base leading-8 text-emerald-50/75">
                เริ่มต้นใช้งานฟรีภายในวันนี้ เชื่อมต่อ LINE OA และใช้งานได้ภายในไม่กี่นาที
              </p>

              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Link
                  className={cn(
                    buttonVariants({ size: "default", variant: "default" }),
                    "h-11 rounded-xl px-5",
                  )}
                  href="/register"
                >
                  <span className="flex items-center gap-3">
                    เริ่มต้นใช้งานฟรี
                    <span className="flex size-5 items-center justify-center rounded-full bg-white/20">
                      <ArrowRight className="size-3.5" />
                    </span>
                  </span>
                </Link>

                <Link
                  className={cn(
                    buttonVariants({ size: "default", variant: "outline" }),
                    "h-11 rounded-xl border-white/20 bg-white/5 px-5 text-white hover:bg-white/10 hover:text-white",
                  )}
                  href="#how-it-works"
                >
                  <span className="flex items-center gap-3">
                    <span className="flex size-6 items-center justify-center rounded-full border border-white/25 text-white">
                      <Play className="size-3.5 fill-current" />
                    </span>
                    ดู Demo
                  </span>
                </Link>
              </div>
            </div>

            <div className="relative flex justify-end">
              <ChatPreview className="origin-right scale-[0.94]" compact />
              <div className="absolute -right-1 bottom-1 rounded-[20px] bg-success px-4 py-4 text-white shadow-[0_18px_35px_rgba(34,197,94,0.24)]">
                <ShoppingCart className="size-8" />
              </div>
              <div className="absolute right-24 top-6 rounded-[20px] bg-success/15 px-4 py-4 text-success">
                <TrendingUp className="size-8" />
              </div>
            </div>
          </div>
        </div>
      </HomepageContainer>
    </section>
  );
}
