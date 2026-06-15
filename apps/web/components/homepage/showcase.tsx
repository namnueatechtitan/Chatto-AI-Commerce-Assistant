import Link from "next/link";
import { ArrowRight, CheckCircle2 } from "lucide-react";

import { showcaseBenefits } from "../../lib/homepage-data";
import { cn } from "../../lib/utils";
import { buttonVariants } from "../ui/Button";
import { Card } from "../ui/Card";
import { HomepageContainer } from "./container";

function DashboardPreview() {
  return (
    <div className="overflow-hidden rounded-[26px] border border-slate-200 bg-white shadow-[0_28px_70px_rgba(15,23,42,0.12)]">
      <div className="grid min-h-[420px] grid-cols-[150px_minmax(0,1fr)_120px] bg-white">
        <div className="bg-[#06281A] p-4 text-white">
          <div className="flex items-center gap-2">
            <div className="flex size-10 items-center justify-center rounded-2xl bg-white/10">
              <span className="text-lg">C</span>
            </div>
            <div>
              <div className="text-sm font-semibold">CHATTO</div>
              <div className="text-[10px] text-white/60">AI Commerce</div>
            </div>
          </div>

          <div className="mt-6 space-y-2">
            {["Dashboard", "Products", "FAQ", "Conversations", "Handover"].map(
              (item, index) => (
                <div
                  key={item}
                  className={`rounded-2xl px-3 py-2 text-xs ${
                    index === 0 ? "bg-success text-white" : "bg-white/5 text-white/70"
                  }`}
                >
                  {item}
                </div>
              ),
            )}
          </div>

          <div className="mt-8 rounded-2xl bg-success px-3 py-3 text-xs shadow-soft">
            เริ่มต้นใช้งานฟรี
          </div>
        </div>

        <div className="bg-white p-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-semibold text-slate-950">
                สวัสดีครับ, Admin Chatto 👋
              </div>
              <div className="mt-1 text-xs text-slate-500">
                สรุปภาพรวมธุรกิจของคุณแบบเรียลไทม์
              </div>
            </div>
            <div className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-success">
              Status Online
            </div>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-4">
            {[
              ["2,456", "ข้อความ"],
              ["1,289", "ลูกค้า"],
              ["356", "ออเดอร์"],
              ["฿45,680", "รายได้"],
            ].map((item, index) => (
              <div key={item[1]} className="rounded-2xl border border-slate-100 bg-slate-50 p-3">
                <div className={`text-lg font-semibold ${index === 3 ? "text-success" : "text-slate-950"}`}>
                  {item[0]}
                </div>
                <div className="mt-1 text-xs text-slate-500">{item[1]}</div>
              </div>
            ))}
          </div>

          <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_190px]">
            <div className="rounded-[24px] border border-slate-100 p-4">
              <div className="text-sm font-semibold text-slate-950">ภาพรวมยอดขาย</div>
              <div className="mt-4 flex h-[180px] items-end gap-2">
                {["h-10", "h-14", "h-12", "h-16", "h-20", "h-24", "h-28", "h-32"].map(
                  (barHeight, index) => (
                    <div
                      key={`${barHeight}-${index}`}
                      className={`w-full rounded-t-full bg-gradient-to-t from-primary to-emerald-300 ${barHeight}`}
                    />
                  ),
                )}
              </div>
            </div>

            <div className="space-y-4">
              <div className="rounded-[24px] border border-slate-100 p-4">
                <div className="text-sm font-semibold text-slate-950">AI Assistant</div>
                <div className="mt-4 flex h-[120px] items-center justify-center rounded-[20px] bg-[#06281A] text-white">
                  Greendy
                </div>
              </div>
              <div className="rounded-[24px] border border-slate-100 p-4">
                <div className="text-sm font-semibold text-slate-950">
                  Conversion
                </div>
                <div className="mt-4 flex items-center justify-center">
                  <div className="flex size-24 items-center justify-center rounded-full border-[12px] border-success/20 border-t-success text-xl font-semibold text-slate-950">
                    24.5%
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-[#06281A] p-3 text-white">
          <div className="rounded-[22px] bg-white/5 p-3">
            <div className="text-sm font-semibold">AI Assistant</div>
            <div className="mt-3 flex h-[320px] items-center justify-center rounded-[18px] bg-gradient-to-b from-emerald-500/25 to-transparent text-center text-sm text-emerald-100">
              พร้อมช่วยตอบลูกค้า
            </div>
            <div className="mt-3 space-y-2 text-xs">
              <div className="rounded-xl bg-white/10 px-3 py-2">ตอบอัตโนมัติ</div>
              <div className="rounded-xl bg-white/10 px-3 py-2">ติดตาม FAQ</div>
              <div className="rounded-xl bg-white/10 px-3 py-2">สรุปปัญหาลูกค้า</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function Showcase() {
  return (
    <section className="pt-16 lg:pt-20">
      <HomepageContainer>
        <div className="grid gap-10 lg:grid-cols-[minmax(0,350px)_minmax(0,1fr)] lg:items-center xl:grid-cols-[minmax(0,380px)_minmax(0,1fr)]">
          <div>
            <h2 className="text-[2.1rem] font-bold leading-tight tracking-[-0.04em] text-slate-950 sm:text-[2.6rem]">
              จัดการทุกอย่างได้ใน
              <br />
              <span className="text-success">DashBoard</span> เดียว
            </h2>
            <p className="mt-5 text-lg leading-8 text-slate-500">
              ติดตามแชท วิเคราะห์ข้อมูลลูกค้า และควบคุม AI ของคุณแบบ Real-Time
            </p>

            <div className="mt-6 space-y-3">
              {showcaseBenefits.map((benefit) => (
                <div key={benefit} className="flex items-start gap-3">
                  <CheckCircle2 className="mt-1 size-5 text-success" />
                  <span className="text-base leading-7 text-slate-700">{benefit}</span>
                </div>
              ))}
            </div>

            <Link
              className={cn(
                buttonVariants({ size: "default", variant: "outline" }),
                "mt-8 h-11 rounded-xl px-5 text-sm",
              )}
              href="/dashboard"
            >
              <span className="flex items-center gap-3">
                สร้าง DashBoard
                <span className="flex size-5 items-center justify-center rounded-full bg-success/10 text-success">
                  <ArrowRight className="size-3.5" />
                </span>
              </span>
            </Link>
          </div>

          <Card className="rounded-[30px] border border-slate-100 p-4 shadow-[0_24px_55px_rgba(15,23,42,0.08)] sm:p-6">
            <DashboardPreview />
          </Card>
        </div>
      </HomepageContainer>
    </section>
  );
}
