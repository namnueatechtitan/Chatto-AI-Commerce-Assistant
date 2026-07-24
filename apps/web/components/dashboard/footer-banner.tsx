/**
 * หน้าที่ไฟล์: ไฟล์นี้เก็บคอมโพเนนต์ส่วน footer banner ที่ใช้ประกอบหน้า dashboard
 */

import { Bot, CheckCircle2, MessageCircleMore, Sparkles } from "lucide-react";

import { Button } from "../ui/Button";

interface FooterBannerProps {
  benefits: string[];
}

/**
 * หน้าที่: คอมโพเนนต์นี้เรนเดอร์แบนเนอร์ Footer
 */
export function FooterBanner({ benefits }: FooterBannerProps) {
  return (
    <section className="relative overflow-hidden rounded-[28px] bg-[#06281A] px-6 py-7 text-white shadow-card sm:px-8 sm:py-8">
      <div className="absolute -right-10 top-8 h-44 w-44 rounded-full bg-emerald-400/10 blur-3xl" />
      <div className="absolute right-28 top-0 h-24 w-24 rounded-full bg-white/10 blur-2xl" />

      <div className="grid gap-8 xl:grid-cols-[minmax(0,1.2fr)_280px_220px] xl:items-center">
        <div>
          <h2 className="text-2xl font-semibold leading-tight sm:text-[2rem]">
            ให้ Chatto ช่วยดูแลลูกค้า เพื่อให้คุณโฟกัสกับการเติบโตของธุรกิจ
          </h2>
          <div className="mt-6 flex flex-wrap gap-4 text-sm text-emerald-50">
            {benefits.map((benefit) => (
              <div key={benefit} className="flex items-center gap-2">
                <CheckCircle2 className="size-4 text-emerald-300" />
                {benefit}
              </div>
            ))}
          </div>
        </div>

        <div className="relative mx-auto flex h-32 w-full max-w-[260px] items-center justify-center">
          <div className="absolute inset-x-8 bottom-4 h-14 rounded-full bg-white/90 blur-sm" />
          <div className="relative flex size-28 animate-float items-center justify-center rounded-full bg-gradient-to-br from-lime-300 via-emerald-400 to-green-500 text-slate-950 shadow-2xl">
            <Bot className="size-12" />
          </div>
          <div className="absolute left-2 top-4 flex items-center gap-1 rounded-full bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-soft">
            <MessageCircleMore className="size-4 text-primary" />
            พร้อมตอบ
          </div>
          <div className="absolute right-2 top-8 flex items-center gap-1 rounded-full bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-soft">
            <Sparkles className="size-4 text-amber-500" />
            Smart AI
          </div>
        </div>

        <div className="space-y-3 text-center xl:text-right">
          <Button className="h-12 rounded-2xl px-6 text-base" size="lg">
            เริ่มใช้งานฟรี 14 วัน →
          </Button>
          <div className="text-sm text-emerald-50/70">ไม่ต้องใช้บัตรเครดิต</div>
        </div>
      </div>
    </section>
  );
}
